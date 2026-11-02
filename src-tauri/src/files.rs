use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};

use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

fn write_atomically(path: &Path, contents: &[u8]) -> io::Result<()> {
    // Through a link to the file it names, so the link is kept and its target replaced.
    let target = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let name = target
        .file_name()
        .ok_or_else(|| io::Error::other("That is not a file."))?
        .to_string_lossy();
    let (beside, mut file) = new_file_beside(&target, &name)?;
    let written = (|| {
        file.write_all(contents)?;
        // The file being replaced may be private: the new one is no more open than it was.
        if let Ok(old) = fs::metadata(&target) {
            fs::set_permissions(&beside, old.permissions())?;
        }
        file.sync_all()?;
        fs::rename(&beside, &target)
    })();
    written.inspect_err(|_| {
        let _ = fs::remove_file(&beside);
    })
}

fn new_file_beside(target: &Path, name: &str) -> io::Result<(PathBuf, File)> {
    static COUNT: AtomicU32 = AtomicU32::new(0);
    loop {
        let unique = format!(
            "{}-{}",
            std::process::id(),
            COUNT.fetch_add(1, Ordering::Relaxed)
        );
        let beside = target.with_file_name(format!(".{name}.{unique}.saving"));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&beside)
        {
            Ok(file) => return Ok((beside, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }
}

#[tauri::command]
pub fn write_diagram_file(app: AppHandle, path: PathBuf, text: String) -> Result<(), String> {
    if !app.fs_scope().is_allowed(&path) {
        return Err("This file was not chosen in a save or open dialog.".into());
    }
    write_atomically(&path, text.as_bytes())
        .map_err(|error| format!("Could not save the file. {error}"))
}

#[cfg(test)]
mod tests {
    use super::write_atomically;
    use std::fs;

    fn folder(name: &str) -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("archstudio-{name}-{}", std::process::id()));
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn replaces_the_file_and_leaves_nothing_else_behind() {
        let folder = folder("replace");
        let file = folder.join("orders.json");
        fs::write(&file, "old").unwrap();
        write_atomically(&file, b"new").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
        assert_eq!(fs::read_dir(&folder).unwrap().count(), 1);
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn a_save_that_fails_leaves_the_old_file_as_it_was() {
        let folder = folder("fail");
        let file = folder.join("missing").join("orders.json");
        assert!(write_atomically(&file, b"new").is_err());
        assert_eq!(fs::read_dir(&folder).unwrap().count(), 0);
        fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn a_file_already_beside_it_is_never_written_over() {
        let folder = folder("beside");
        let file = folder.join("orders.json");
        let taken = folder.join(format!(".orders.json.{}-0.saving", std::process::id()));
        fs::write(&taken, "someone else's").unwrap();
        fs::write(&file, "old").unwrap();
        for _ in 0..3 {
            write_atomically(&file, b"new").unwrap();
        }
        assert_eq!(fs::read_to_string(&file).unwrap(), "new");
        assert_eq!(fs::read_to_string(&taken).unwrap(), "someone else's");
        fs::remove_dir_all(folder).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_link_is_kept_and_what_it_points_to_is_replaced() {
        let folder = folder("link");
        let real = folder.join("real.json");
        let link = folder.join("link.json");
        fs::write(&real, "old").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();
        write_atomically(&link, b"new").unwrap();
        assert!(fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(&real).unwrap(), "new");
        fs::remove_dir_all(folder).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn a_private_file_stays_private() {
        use std::os::unix::fs::PermissionsExt;
        let folder = folder("private");
        let file = folder.join("orders.json");
        fs::write(&file, "old").unwrap();
        fs::set_permissions(&file, fs::Permissions::from_mode(0o600)).unwrap();
        write_atomically(&file, b"new").unwrap();
        assert_eq!(
            fs::metadata(&file).unwrap().permissions().mode() & 0o777,
            0o600
        );
        fs::remove_dir_all(folder).unwrap();
    }
}
