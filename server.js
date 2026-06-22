// Get env vars
require('dotenv').config();
// Import libs
const express = require('express');
const cors = require('cors');
const path = require('path')

const { MongoClient } = require('mongodb');

const app = express();

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URL);

app.get('/api/arbol-completo/:id', async (req, res) => {
  try {
    const plan_id = parseInt(req.params.id ?? "1");
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const planes = db.collection('planes');

    const result = await planes.findOne({
      id: plan_id
    });

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

app.get('/api/materia/:id', async (req, res) => {
  try {
    const mat_id = parseInt(req.params.id ?? "1");
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const materias = db.collection('materias');

    const result = await materias.findOne({
      id: mat_id
    });

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

app.get('/api/grupos-materia/:id', async (req, res) => {
  try {
    const mat_id = parseInt(req.params.id ?? "1");
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const grupos = db.collection('grupos');

    const result = await grupos.find({
      "materia.id": mat_id
    }).toArray();

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

app.post('/api/inscribir', async (req, res) => {
  try {
    const {grupo_id, user_id, pensum_id} = req.body;
    
    await client.connect();
    const db = client.db(process.env.DB_NAME);

    const grupos = db.collection('grupos');
    const historiales = db.collection('historiales');
    const materias = db.collection('materias');

    const conflictos = await historiales.aggregate([
      {
        $match: {
          estudiante_id: user_id,
          "plan.id": pensum_id
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
                id: grupo_id
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
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$horario_actual.dia", "$horario_nuevo.dia"] },
              { $lt: ["$horario_actual.hora_inicio", "$horario_nuevo.hora_fin"] },
              { $gt: ["$horario_actual.hora_fin", "$horario_nuevo.hora_inicio"] },
            ]
          }
        }
      }
    ]).toArray()

    if (conflictos.length > 0)
    {
      console.error("Hay conflictos");
      res.status(500).json({conflictos, message: "Hay conflictos con materias en curso."});
    }
    else
    {
      const grupo = await grupos.findOne({
        id: grupo_id
      })

      if (grupo.inscritos.length >= grupo.cupos_totales)
      {
        res.status(500).json({message: "El grupo ya está lleno.."});
      }
      else
      {
        const materia = await materias.findOne({
          id: grupo.materia.id
        })

        const new_curso = {
          "id": crypto.randomUUID(),
          "materia": {
            "id": materia.id,
            "nombre": materia.nombre,
            "creditos": materia.creditos
          },
          "grupo_id": grupo_id,
          "periodo": grupo.periodo,
          "estado": "en curso"
        }

        await historiales.updateOne({
          estudiante_id: user_id,
          "plan.id": pensum_id
        }, {
          $push: { cursos: new_curso }
        })
        
        res.status(200).json({});
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});