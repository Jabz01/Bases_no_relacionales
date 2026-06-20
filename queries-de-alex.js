// Arbol de una carrera
db.planes.findOne({
    id: 1
})

// Materias ya vistas por estudiante y plan (aprobadas)
db.historiales.aggregate([
    {
        $match: {
            estudiante_id: 1,
            "plan.id": 1,
        }
    },
    {
        $project: {
            cursos: {
                $filter: {
                    input: "$cursos",
                    as: "curso",
                    cond: {
                        $eq: ["$$curso.estado", "aprobada"]
                    }
                }
            }
        }
    }
])

// Prerequisitos de una materia
db.planes.aggregate([
    {
        $match: {
            id: 1
        }
    },
    {
        $project: {
            materia: {
                $first: {
                    $filter: {
                        input: "$materias",
                        as: "materia",
                        cond: { $eq: ["$$materia.id", 1] }
                    }
                }
            }
        }
    },
    {
        $project: {
            "materia.prerrequisitos": 1
        }
    },
    {
        $lookup: {
            from: "materias",
            localField: "materia.prerrequisitos",
            foreignField: "id",
            as: "previas"
        }
    }
])

// Promedio acumulado de estudiante en un plan
db.historiales.aggregate([
    {
        $match: {
            estudiante_id: 1,
            "plan.id": 1
        }
    },
    {
        $project: {
            promedio: {
                $avg: {
                    $map: {
                        input: {
                            $filter: {
                                input: "$cursos",
                                as: "curso",
                                cond: {
                                    $isNumber: "$$curso.nota_final"
                                }
                            }
                        },
                        as: "curso",
                        in: "$$curso.nota_final"
                    }
                }
            }
        }
    }
])

// Materias inscritas en el semestre actual (en curso)
db.historiales.aggregate([
    {
        $match: {
            estudiante_id: 1
        }
    },
    {
        $project: {
            materias: {
                $filter: {
                    input: "$cursos",
                    as: "curso",
                    cond: { $eq: ["en curso", "$$curso.estado"] }
                }
            }
        }
    }
])

// Materias con mayor tasa de reprobación.
db.historiales.aggregate([
    {
        $unwind: "$cursos"
    },
    {
        $match: {
            "cursos.estado": "reprobada"
        }
    },
    {
        $group: {
            _id: {
                id: "$cursos.materia.id",
                nombre: "$cursos.materia.nombre"
            },
            fallas: { $sum: 1 }
        }
    },
    { $sort: { fallas: -1 } },
    { $limit: 5 }
])

// Choques de horario antes de inscribir
db.historiales.aggregate([
    {
        $match: {
            estudiante_id: 1,
            "plan.id": 1
        }
    },
    { $unwind: "$cursos" },
    {
        $match: {
            "cursos.estado": { $in: ["en curso", "en espera"] }
        }
    },
    {
        $lookup: {
            from: "grupos",
            foreignField: "id",
            localField: "cursos.grupo_id",
            as: "grupo_actual"
        }
    },
    {
        $unwind: "$grupo_actual"
    },
    {
        $lookup: {
            from: "grupos",
            pipeline: [
                {
                    $match: {
                        id: 2
                    }
                }
            ],
            as: "grupo_nuevo"
        }
    },
    {
        $unwind: "$grupo_nuevo"
    },
    {
        $project: {
            id_actual: "$grupo_actual.id",
            id_nuevo: "$grupo_nuevo.id",
            materia_actual: "$grupo_actual.materia",
            materia_nueva: "$grupo_nuevo.materia",
            horario_actual: "$grupo_actual.horario",
            horario_nuevo: "$grupo_nuevo.horario"
        }
    },
    {
        $unwind: "$horario_actual"
    },
    {
        $unwind: "$horario_nuevo"
    },
    {$match: {
        $expr: {
            $and: [
                {$eq: [ "$horario_actual.dia", "$horario_nuevo.dia" ]},
                {$lt: [ "$horario_actual.hora_inicio", "$horario_nuevo.hora_fin" ]},
                {$gt: [ "$horario_actual.hora_fin", "$horario_nuevo.hora_inicio" ]},
            ]
        }
    }}
])
