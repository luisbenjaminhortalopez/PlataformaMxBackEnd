const express = require('express');
const noticias = require('../controllers/noticias');
const router = express.Router();

router.get('/obtener-noticias', noticias.obtenerNoticias);

router.get('/obtener-detalle-noticia/:id', noticias.obtenerDetalleNoticia);

router.get('/obtener-categorias', noticias.obtenerCategorias);

router.post('/agregar-noticia', noticias.agregarNoticia);

router.put('/actualizar-noticia/:id', noticias.actualizarNoticia);

router.delete('/eliminar-noticia/:id', noticias.eliminarNoticia);

module.exports = router;