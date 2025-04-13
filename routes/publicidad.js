const express = require('express');
const publicidad = require('../controllers/publicidad');
const router = express.Router();

router.get('/obtener-publicidad', publicidad.obtenerPublicidad);

router.post('/agregar-publicidad', publicidad.agregarPublicidad);

router.delete('/eliminar-publicidad/:id', publicidad.eliminarPublicidad);

router.put('/actualizar-publicidad/:id', publicidad.actualizarPublicidad);

module.exports = router;