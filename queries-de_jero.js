//Materias disponibles para inscribir según historial del estudiante 
db.historiales.aggregate([
  { $match: { estudiante_id: 1 } },

  // Extraer solo las materias aprobadas como un array simple de IDs
  {
    $addFields: {
      materias_aprobadas: {
        $map: {
          input: {
            $filter: {
              input: "$cursos",
              as: "curso",
              cond: { $eq: ["$$curso.estado", "aprobada"] }
            }
          },
          as: "c",
          in: "$$c.materia.id"
        }
      },
      materias_en_curso: {
        $map: {
          input: {
            $filter: {
              input: "$cursos",
              as: "curso",
              cond: { $eq: ["$$curso.estado", "en curso"] }
            }
          },
          as: "c",
          in: "$$c.materia.id"
        }
      }
    }
  },

  // Traer el plan completo
  {
    $lookup: {
      from: "planes",
      localField: "plan.id",
      foreignField: "id",
      as: "plan_completo"
    }
  },
  { $unwind: "$plan_completo" },

  // Desenrollar las materias del plan para evaluarlas una por una
  { $unwind: "$plan_completo.materias" },

  // Filtrar: que NO esté aprobada, que NO esté en curso, y que TODOS sus prerrequisitos estén aprobados
  {
    $match: {
      $expr: {
        $and: [
          { $not: { $in: ["$plan_completo.materias.id", "$materias_aprobadas"] } },
          { $not: { $in: ["$plan_completo.materias.id", "$materias_en_curso"] } },
          {
            $setIsSubset: ["$plan_completo.materias.prerrequisitos", "$materias_aprobadas"]
          }
        ]
      }
    }
  },

  // Proyectar solo lo necesario
  {
    $project: {
      _id: 0,
      estudiante_id: 1,
      materia_disponible: "$plan_completo.materias"
    }
  }
])



// -----------------------------------------------------------------

//Materias cerradas y en espera

db.grupos.aggregate([
  {
    $addFields: {
      cupos_disponibles: { $subtract: ["$cupos_totales", { $size: "$inscritos" }] }
    }
  },
  {
    $match: { cupos_disponibles: { $lte: 0 } }
  },
  {
    $addFields: {
      estado_calculado: {
        $cond: {
          if: { $eq: ["$periodo", "2026-1"] },
          then: "en espera",
          else: "cerrada"
        }
      }
    }
  },
  {
    $project: {
      _id: 0,
      id: 1,
      "materia.nombre": 1,
      periodo: 1,
      cupos_totales: 1,
      inscritos_count: { $size: "$inscritos" },
      estado_calculado: 1
    }
  }
])

// --------------------------------------------------------------------------

//Progreso academico del estudiante por semestre.

db.historiales.aggregate([
  { $match: { estudiante_id: 1 } },

  // Traer el plan completo del estudiante
  {
    $lookup: {
      from: "planes",
      localField: "plan.id",
      foreignField: "id",
      as: "plan_completo"
    }
  },
  { $unwind: "$plan_completo" },

  // Armar el set de materias aprobadas por el estudiante
  {
    $addFields: {
      materias_aprobadas: {
        $map: {
          input: {
            $filter: {
              input: "$cursos",
              as: "c",
              cond: { $eq: ["$$c.estado", "aprobada"] }
            }
          },
          as: "c",
          in: "$$c.materia.id"
        }
      }
    }
  },

  // Desenrollar las materias del plan, una por una
  { $unwind: "$plan_completo.materias" },

  // Marcar si cada materia del plan está aprobada o no
  {
    $addFields: {
      "plan_completo.materias.aprobada": {
        $in: ["$plan_completo.materias.id", "$materias_aprobadas"]
      }
    }
  },

  // Agrupar por semestre sugerido
  {
    $group: {
      _id: "$plan_completo.materias.semestre_sugerido",
      total_materias: { $sum: 1 },
      creditos_totales: { $sum: "$plan_completo.materias.creditos" },
      aprobadas: {
        $sum: { $cond: ["$plan_completo.materias.aprobada", 1, 0] }
      },
      creditos_aprobados: {
        $sum: {
          $cond: [
            "$plan_completo.materias.aprobada",
            "$plan_completo.materias.creditos",
            0
          ]
        }
      }
    }
  },

  { $sort: { _id: 1 } },

  {
    $project: {
      _id: 0,
      semestre: "$_id",
      total_materias: 1,
      aprobadas: 1,
      pendientes: { $subtract: ["$total_materias", "$aprobadas"] },
      creditos_totales: 1,
      creditos_aprobados: 1,
      porcentaje_avance: {
        $round: [
          { $multiply: [{ $divide: ["$aprobadas", "$total_materias"] }, 100] },
          0
        ]
      }
    }
  }
])

// -------------------------------------------------------------------------

//Promedio por semestre.

db.historiales.aggregate([
  { $match: { estudiante_id: 1 } },
  { $unwind: "$cursos" },

  // Solo cursos que ya tienen nota final (aprobada o reprobada, no "en curso")
  {
    $match: {
      "cursos.nota_final": { $exists: true }
    }
  },

  {
    $group: {
      _id: "$cursos.periodo",
      promedio_simple: { $avg: "$cursos.nota_final" },
      suma_ponderada: {
        $sum: { $multiply: ["$cursos.nota_final", "$cursos.materia.creditos"] }
      },
      creditos_periodo: { $sum: "$cursos.materia.creditos" },
      materias_vistas: { $sum: 1 }
    }
  },

  {
    $project: {
      _id: 0,
      periodo: "$_id",
      materias_vistas: 1,
      creditos_periodo: 1,
      promedio_simple: { $round: ["$promedio_simple", 2] },
    }
  },

  { $sort: { periodo: 1 } }
])

// --------------------------------------------------------------------------------------

// Cupos disponibles por grupo/materia.

db.grupos.aggregate([
  { $match: { periodo: "2026-1" } },

  // Traer el plan de Ingeniería de Sistemas
  {
    $lookup: {
      from: "planes",
      pipeline: [{ $match: { id: 1 } }],
      as: "plan"
    }
  },
  { $unwind: "$plan" },

  // Armar el set de IDs de materias que pertenecen a ese plan
  {
    $addFields: {
      materias_del_plan: {
        $map: {
          input: "$plan.materias",
          as: "m",
          in: "$$m.id"
        }
      }
    }
  },

  // Filtrar: solo grupos cuya materia esté en ese plan
  {
    $match: {
      $expr: { $in: ["$materia.id", "$materias_del_plan"] }
    }
  },

  // Calcular los cupos
  {
    $project: {
      _id: 0,
      grupo_id: "$id",
      materia: "$materia.nombre",
      periodo: 1,
      cupos_totales: 1,
      inscritos_actuales: { $size: "$inscritos" },
      cupos_restantes: {
        $subtract: ["$cupos_totales", { $size: "$inscritos" }]
      }
    }
  },

  { $sort: { materia: 1 } }
])

// -----------------------------------------------------------------------------

//Estudiantes que pueden graduarse. (créditos mínimos cumplidos)

db.historiales.aggregate([
  // Solo cursos aprobados
  { $unwind: "$cursos" },
  { $match: { "cursos.estado": "aprobada" } },

  // Sumar créditos aprobados por estudiante
  {
    $group: {
      _id: { estudiante_id: "$estudiante_id", plan: "$plan" },
      creditos_aprobados: { $sum: "$cursos.materia.creditos" }
    }
  },

  // Traer el plan para saber cuántos créditos se necesitan en total
  {
    $lookup: {
      from: "planes",
      localField: "_id.plan.id",
      foreignField: "id",
      as: "plan_info"
    }
  },
  { $unwind: "$plan_info" },

  // Comparar créditos aprobados contra el mínimo requerido
  {
    $match: {
      $expr: { $gte: ["$creditos_aprobados", "$plan_info.creditos_totales"] }
    }
  },

  {
    $project: {
      _id: 0,
      estudiante_id: "$_id.estudiante_id",
      plan: "$plan_info.nombre",
      creditos_aprobados: 1,
      creditos_requeridos: "$plan_info.creditos_totales",
      puede_graduarse: { $literal: true }
    }
  }
])

// -----------------------------------------------------------------------------------

//Materias menos cursadas en una carrera.

db.planes.aggregate([
  { $match: { id: 1 } },
  { $unwind: "$materias" },

  // Por cada materia del plan, contar cuántas veces aparece en todos los historiales
  {
    $lookup: {
      from: "historiales",
      let: { materia_id: "$materias.id" },
      pipeline: [
        { $unwind: "$cursos" },
        { $match: { $expr: { $eq: ["$cursos.materia.id", "$$materia_id"] } } },
        { $count: "veces_cursada" }
      ],
      as: "conteo"
    }
  },

  {
    $project: {
      _id: 0,
      materia: "$materias.nombre",
      semestre_sugerido: "$materias.semestre_sugerido",
      veces_cursada: {
        $ifNull: [{ $arrayElemAt: ["$conteo.veces_cursada", 0] }, 0]
      }
    }
  },

  { $sort: { veces_cursada: 1 } }
])

//----------------------------------------------------------------------------------------

//Materias aún no vistas.

db.historiales.aggregate([
  { $match: { estudiante_id: 1 } },

  {
    $lookup: {
      from: "planes",
      localField: "plan.id",
      foreignField: "id",
      as: "plan_completo"
    }
  },
  { $unwind: "$plan_completo" },

  // Set de todas las materias que YA aparecen en el historial (sin importar el estado)
  {
    $addFields: {
      materias_vistas: {
        $map: {
          input: "$cursos",
          as: "c",
          in: "$$c.materia.id"
        }
      }
    }
  },

  { $unwind: "$plan_completo.materias" },

  // Dejar solo las que NO están en ese set
  {
    $match: {
      $expr: {
        $not: { $in: ["$plan_completo.materias.id", "$materias_vistas"] }
      }
    }
  },

  {
    $project: {
      _id: 0,
      estudiante_id: 1,
      materia_no_vista: "$plan_completo.materias"
    }
  }
])