# lib

Temporary compatibility exports during repository hygiene.

New generic frontend helpers/types belong under `src/shared/`. Feature-specific logic belongs with its owning feature.

Compatibility facades remain here only while callers/tests migrate; new production code should not add modules to this folder.
