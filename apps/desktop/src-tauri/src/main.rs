#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
mod windows_single_instance;

fn main() {
    #[cfg(target_os = "windows")]
    let _single_instance_guard = match windows_single_instance::acquire_or_signal_existing() {
        Ok(windows_single_instance::SingleInstanceOutcome::Primary(guard)) => guard,
        Ok(windows_single_instance::SingleInstanceOutcome::SecondarySignalled) => return,
        Err(message) => {
            windows_single_instance::show_single_instance_error(&message);
            return;
        }
    };

    skribly_lib::run();
}
