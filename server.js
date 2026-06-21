// Get env vars
require('dotenv').config();
// Import libs
const express = require('express');
const cors = require('cors');
const path = require('path')

const { MongoClient } = require('mongodb');

const app = express();
app.use(cors());

const client = new MongoClient(process.env.MONGODB_URL);

app.get('/api/arbol-completo/:id', async (req, res) => {
  try {
    const plan_id = parseInt(req.params.id ?? "1");
    await client.connect();
    const db = client.db(process.env.DB_NAME); 
    const planes = db.collection('planes');

    const arbol = await planes.findOne({
        id: plan_id
    });

    res.json(arbol); 

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${process.env.PORT}`);
});