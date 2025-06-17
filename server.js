const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { initializeApp } = require("firebase/app");
const {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} = require("firebase/auth");
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

const firebaseConfig = {
  apiKey: "AIzaSyA1yU0-5K8sSEiRphq4qEQz7ZaLJ4JuG9E",
  authDomain: "fixup-a9c72.firebaseapp.com",
  projectId: "fixup-a9c72",
  storageBucket: "fixup-a9c72.firebasestorage.app",
  messagingSenderId: "888462125878",
  appId: "1:888462125878:web:0cd702a7e9eab17be82197",
  measurementId: "G-JB4J437WJF",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const MONGO_URI =
  "mongodb+srv://gipsydanger810:kEuO5OJJmPSPYCws@cluster0.l1btn.mongodb.net/Fixup?retryWrites=true&w=majority";
const DATABASE_NAME = "Fixup";
const COLLECTION_NAME = "Usuarios";

async function connectToMongo() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  return client;
}

const server = http.createServer(app);

// Configurar socket.io sobre ese servidor
const io = new Server(server, {
  cors: {
    origin: '*', // Asegúrate de restringir esto en producción
  }
});

// Manejar conexiones de sockets
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Recibir mensaje y reenviarlo
  socket.on('nuevoMensaje', (mensaje) => {
    console.log('Mensaje recibido:', mensaje);
    // reenviar a todos (o puedes usar rooms para enviar solo al destinatario)
    io.emit('mensajeRecibido', mensaje);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.post("/logIn", async (req, res) => {
  const { correo, password } = req.body;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, correo, password);
    const user = userCredential.user;

    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const mongoUser = await collection.findOne({ uid: user.uid });

    if (!mongoUser) {
      res.status(404).json({ msg: "Usuario no encontrado en MongoDB" });
      return;
    }

    res.json({
      msg: "Login exitoso",
      uid: user.uid,
      email: user.email,
      tipo: mongoUser.tipo,
    });

    client.close();
  } catch (error) {
    console.error("Error al iniciar sesión:", error.code, error.message);
    res.status(400).json({
      msg: "Credenciales incorrectas",
      error: error.code,
    });
  }
});

app.post("/signUp", async (req, res) => {
  const { correo, password, tipo } = req.body;

  if (!correo || !password || !tipo) {
    return res.status(400).json({ msg: "Faltan campos requeridos" });
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
    const user = userCredential.user;

    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const nuevoUsuario = {
      uid: user.uid,
      correo,
      tipo,
      creadoEn: new Date(),
    };

    await collection.insertOne(nuevoUsuario);

    res.json({
      msg: "Registro exitoso",
      uid: user.uid,
      email: user.email,
      tipo,
    });

    client.close();
  } catch (error) {
    console.error("Error en el registro:", error.code, error.message);
    res.status(400).json({
      msg: "Error en el registro",
      error: error.code,
    });
  }
});

app.post("/perfil/:uid", async (req, res) => {
  const { uid } = req.params;
  const {
    nombre,
    direccion,
    descripcionGeneral,
    especialidades,
    servicios,
    fotoBase64,
    modificado
  } = req.body;

  if (!uid || !nombre || !descripcionGeneral) {
    return res.status(400).json({ msg: "Faltan datos obligatorios" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const resultado = await collection.updateOne(
      { uid },
      {
        $set: {
          nombre,
          direccion,
          descripcionGeneral,
          especialidades,
          servicios,
          fotoBase64,
          actualizadoEn: new Date(),
          modificado,
        },
      },
      { upsert: true } 
    );

    res.json({
      msg: "Perfil guardado correctamente",
      resultado,
    });

    client.close();
  } catch (error) {
    console.error("Error al guardar perfil:", error);
    res.status(500).json({ msg: "Error al guardar perfil" });
  }
});

app.get("/getProfile", async (req, res) => {
  const { uid } = req.query;

  if (!uid) {
    return res.status(400).json({ msg: "El uid es requerido" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const user = await collection.findOne({ uid });

    if (!user) {
      return res.status(404).json({ msg: "Usuario no encontrado" });
    }

    res.json({
      msg: "Perfil cargado exitosamente",
      id: user.uid,
      nombre: user.nombre,
      direccion: user.direccion,
      descripcion: user.descripcionGeneral,
      foto: user.fotoBase64,
      especialidades: user.especialidades,
      serviciosOfrecidos: user.servicios,
    });

    client.close();
  } catch (error) {
    console.error("Error al cargar perfil:", error.message);
    res.status(500).json({
      msg: "Error al cargar el perfil",
      error: error.message,
    });
  }
});

app.post("/guardarPerfilBasico/:uid", async (req, res) => {
  const { uid } = req.params;
  const { nombre, fotoBase64, modificado } = req.body;

  if (!uid || !nombre) {
    return res.status(400).json({ msg: "Faltan datos requeridos" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const resultado = await collection.updateOne(
      { uid },
      {
        $set: {
          nombre,
          fotoBase64,
          modificado,
          actualizadoEn: new Date(),
        },
      },
      { upsert: true }
    );

    res.json({
      msg: "Nombre y foto guardados correctamente",
      resultado,
    });

    client.close();
  } catch (error) {
    console.error("Error al guardar nombre y foto:", error);
    res.status(500).json({ msg: "Error al guardar nombre y foto" });
  }
});

app.get('/obtenerTecnicos', async (req, res) => {
  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const tecnicos = await collection
      .find({ tipo: 'tecnico', modificado: 'Si' })
      .toArray();

    res.json(tecnicos);

    client.close();
  } catch (error) {
    console.error('Error al obtener técnicos:', error);
    res.status(500).json({ msg: 'Error al obtener técnicos' });
  }
});

app.get('/buscarTecnicos', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ msg: 'Falta el parámetro de búsqueda' });
    }

    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const regex = new RegExp(q, 'i');

    const tecnicos = await collection
      .find({
        tipo: 'tecnico',
        modificado: 'Si',
        $or: [
          { nombre: regex },
          { especialidades: regex },
          { descripcionGeneral: regex },
          { 'servicios.nombre': regex },
        ],
      })
      .toArray();

    res.json(tecnicos);

    client.close();
  } catch (error) {
    console.error('Error al buscar técnicos:', error);
    res.status(500).json({ msg: 'Error al buscar técnicos' });
  }
});

app.post("/crearChat", async (req, res) => {
  const { cliente, tecnico, idchat } = req.body;

  if (!cliente || !tecnico || !idchat) {
    return res.status(400).json({ msg: "Faltan campos requeridos" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('Chats');

    const chatExistente = await collection.findOne({ idchat });

    if (chatExistente) {
      client.close();
      return res.status(200).json({ msg: "El chat ya existe. No se creó uno nuevo." });
    }

    const nuevoChat = {
      cliente,
      tecnico,
      idchat,
    };

    await collection.insertOne(nuevoChat);

    res.json({
      msg: "Registro exitoso",
    });

    client.close();
  } catch (error) {
    console.error("Error en el registro:", error.code, error.message);
    res.status(400).json({
      msg: "Error en el registro",
      error: error.code,
    });
  }
});

app.get('/obtenerChats/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection("Chats");

    const chats = await collection
      .find({
        $or: [
          { cliente: uid },
          { tecnico: uid }
        ]
      })
      .sort({ fecha: -1 })
      .toArray();

    res.json(chats);

    client.close();
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({ msg: 'Error al obtener chats' });
  }
});

app.get('/obtenerUsuarioChat/:uid', async (req, res) => {
  const { uid } = req.params;
  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const usuario = await collection.findOne({ uid: uid });

    res.json(usuario);

    client.close();
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ msg: 'Error al obtener usuario' });
  }
});

app.post("/crearMensajes", async (req, res) => {
  const { mensaje, fecha, enviadopor, recibidopor } = req.body;

  if (!mensaje || !fecha || !enviadopor || !recibidopor) {
    return res.status(400).json({ msg: "Faltan campos requeridos" });
  }

  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('Mensajes');

    const nuevoMensaje = {
      mensaje,
      fecha,
      enviadopor,
      recibidopor,
    };

    await collection.insertOne(nuevoMensaje);

    io.emit('mensajeRecibido', nuevoMensaje);

    res.json({
      msg: "Registro exitoso",
    });

    client.close();
  } catch (error) {
    console.error("Error en el registro:", error.code, error.message);
    res.status(400).json({
      msg: "Error en el registro",
      error: error.code,
    });
  }
});

app.post('/obtenerMensajes', async (req, res) => {
  const { enviadopor, recibidopor } = req.body;
  try {
    const client = await connectToMongo();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection("Mensajes");

    const mensajes = await collection.find({
      $or: [
        { enviadopor: enviadopor, recibidopor: recibidopor },
        { enviadopor: recibidopor, recibidopor: enviadopor }
      ]
    }).sort({ fecha: 1 }).toArray(); // orden cronológico

    res.json(mensajes);

    client.close();
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ msg: 'Error al obtener mensajes' });
  }
});



app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
