import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PC_CSS_FILES = [
    '01-foundation-shell.css',
    '02-settings-compat.css',
    '03-shared-components.css',
    '04-settings-page.css',
    '05a-legacy-page-primitives.css',
    '05b-category-base.css',
    '05c-global-overlays.css',
    '05d-welcome-library-base.css',
    '05e-page-late-overrides.css',
    '06-responsive-overrides.css',
    '07-theme-toggle.css',
    '08-goal-plan.css',
    '09-tetris.css',
    '10-plane.css',
    '11-plant.css',
    '12-compress.css',
];

export function readPcCss() {
    return PC_CSS_FILES
        .map((fileName) => readFileSync(resolve(process.cwd(), 'src/css/pc', fileName), 'utf8'))
        .join('\n');
}
