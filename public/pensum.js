function subject_box_HTML(id, nombre, creditos, func) {
    return `<button type="button" onclick="${func}(${id})" class="pensum-subject-box C${creditos}">
                        <span class="pensum-subject-title">${nombre}</span>
                        <div>
                            <img class="pensum-subject-star-icon" src="star.svg" />
                            <span class="pensum-subject-credits-number">${creditos}</span>
                        </div>
                    </button>`
}

function pensum_column_HTML(subjs) {
    return `
            <div class="pensum-column">${subjs}</div>
            `
}

function pensum_HTML(plan, subject_callback) {
    penInnerCnt_innerHTML = "";
    penHeader_innerHTML = plan.nombre;

    let materias = plan.materias;

    let setDepth = (materia, depth) => {
        if (!("depth" in materia)) {
            materia.depth = -1;
        }

        if (materia.depth < depth) {
            materia.depth = depth;

            for (const mat of materias) {
                if (mat.prerrequisitos.includes(materia.id)) {
                    setDepth(mat, depth + 1);
                }
            }
        }
    }

    for (const materia of materias) {
        if (materia.prerrequisitos.length == 0) {
            setDepth(materia, 0);
        }
    }

    let contenedores = {}

    for (const materia of materias) {
        if (!(materia.depth in contenedores)) {
            contenedores[materia.depth] = ""
        }
        contenedores[materia.depth] += subject_box_HTML(materia.id, materia.nombre, materia.creditos, subject_callback);
    }

    for (const depth of Object.keys(contenedores)) {
        penInnerCnt_innerHTML += pensum_column_HTML(contenedores[depth])
    }

    return {
        penInnerCnt_innerHTML,
        penHeader_innerHTML
    }
}
