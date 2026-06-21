const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());

const url = "mongodb://127.0.0.1:27017"; 
const client = new MongoClient(url);

// Creamos la "Ruta" o URL que tu HTML va a consultar
app.get('/api/arbol-completo', async (req, res) => {
  try {
    await client.connect();
    const db = client.db('dblorpen'); 
    const planes = db.collection('planes');

    const arbol = await planes.findOne({
        id:1
    });

    res.json(arbol); 

  } catch (error) {
    console.error(error);
    res.status(500).send("Error en el servidor");
  }
});

// Encendemos el servidor en el puerto 3000
app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});