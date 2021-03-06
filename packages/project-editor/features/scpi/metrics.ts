import { getProperty, asArray } from "project-editor/core/object";

import { Project } from "project-editor/project/project";

import { Scpi } from "project-editor/features/scpi/scpi";

////////////////////////////////////////////////////////////////////////////////

export function metrics(project: Project): { [key: string]: string | number } {
    let scpi = getProperty(project, "scpi") as Scpi;

    return {
        SCPI: "",
        "<span class='td-indent'>Commands</span>": asArray(scpi.subsystems).reduce(
            (c, s) => c + asArray(s.commands).reduce(c => c + 1, 0),
            0
        )
    };
}
