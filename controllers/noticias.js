const {dbConnection} = require("../database/config");
const multer = require("multer");
const {S3Client, PutObjectCommand, HeadObjectCommand} = require("@aws-sdk/client-s3");

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const upload = multer({storage: multer.memoryStorage()});

exports.agregarNoticia = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    upload.fields([
        {name: "imagen_portada", maxCount: 1},
        {name: "imagen01", maxCount: 1},
        {name: "imagen02", maxCount: 1},
    ])(req, res, async (err) => {
        if (err) return res.status(500).json({error: "Error al subir las imágenes"});

        const {titulo, autor, fecha_publicacion, fecha_vencimiento, categoria_id, seccion01, seccion02} = req.body;

        if (!titulo || !autor || !fecha_vencimiento || !categoria_id || !seccion01) {
            return res.status(400).json({error: "Faltan campos obligatorios"});
        }

        const files = req.files;
        let connection;
        let transaction;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();
            transaction = true;

            const insertQuery = `
                INSERT INTO Noticias
                (titulo, autor, fecha_publicacion, fecha_vencimiento, categoria_id, seccion01, seccion02)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const [result] = await connection.query(insertQuery, [
                titulo,
                autor,
                fecha_publicacion,
                fecha_vencimiento,
                categoria_id,
                seccion01,
                seccion02 || null,
            ]);

            const noticiaId = result.insertId;
            const imagenes = {};

            const subirImagen = async (file, tipo) => {
                const extension = file.originalname.split('.').pop();
                const s3Key = `noticias/${noticiaId}_${tipo}.${extension}`;

                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: s3Key,
                    Body: file.buffer,
                    ACL: "public-read",
                    ContentType: file.mimetype,
                };

                await s3.send(new PutObjectCommand(params));
                return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
            };

            const updateFields = {};
            const updateValues = [];

            if (files.imagen_portada) {
                const url = await subirImagen(files.imagen_portada[0], 'portada');
                updateFields.imagen_portada = url;
                imagenes.imagen_portada = url;
            }

            if (files.imagen01) {
                const url = await subirImagen(files.imagen01[0], 'imagen01');
                updateFields.imagen01 = url;
                imagenes.imagen01 = url;
            }

            if (files.imagen02) {
                const url = await subirImagen(files.imagen02[0], 'imagen02');
                updateFields.imagen02 = url;
                imagenes.imagen02 = url;
            }

            if (Object.keys(updateFields).length > 0) {
                const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
                const updateQuery = `UPDATE Noticias SET ${setClause} WHERE id = ?`;

                await connection.query(updateQuery, [
                    ...Object.values(updateFields),
                    noticiaId
                ]);
            }

            await connection.commit();
            transaction = false;

            res.json({
                mensaje: "Noticia agregada exitosamente",
                id: noticiaId,
                imagenes,
            });
        } catch (error) {
            console.error(error);
            if (transaction) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Error al hacer rollback:", rollbackError);
                }
            }
            res.status(500).json({error: "Error al agregar la noticia"});
        } finally {
            if (connection) connection.release();
        }
    });
};

exports.actualizarNoticia = async (req, res) => {
    const pool = await dbConnection();
    let connection;
    let transaction;

    upload.fields([
        {name: "imagen_portada", maxCount: 1},
        {name: "imagen01", maxCount: 1},
        {name: "imagen02", maxCount: 1},
    ])(req, res, async (err) => {
        if (err) return res.status(500).json({error: "Error al subir las imágenes"});

        const {id} = req.params;
        const {titulo, autor, fecha_publicacion, fecha_vencimiento, categoria_id, seccion01, seccion02} = req.body;
        const files = req.files;

        try {
            connection = await pool.getConnection();
            await connection.beginTransaction();
            transaction = true;

            const [noticia] = await connection.query('SELECT * FROM Noticias WHERE id = ?', [id]);
            if (noticia.length === 0) {
                return res.status(404).json({error: "Noticia no encontrada"});
            }

            const currentNoticia = noticia[0];
            const updateFields = {};
            const updateValues = [];
            const imagenes = {};

            const subirImagenVersionada = async (file, tipo, currentUrl) => {
                let version = 1;
                const extension = file.originalname.split('.').pop();
                let s3Key;

                if (currentUrl) {
                    const urlParts = currentUrl.split('/');
                    const fileName = urlParts[urlParts.length - 1];
                    const versionMatch = fileName.match(/_v(\d+)\./);

                    if (versionMatch) {
                        version = parseInt(versionMatch[1]) + 1;
                        s3Key = `noticias/${fileName.split('_v')[0]}_v${version}.${extension}`;
                    } else {
                        s3Key = `noticias/${fileName.split('.')[0]}_v2.${extension}`;
                    }
                } else {
                    s3Key = `noticias/${id}_${tipo}_v1.${extension}`;
                }

                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: s3Key,
                    Body: file.buffer,
                    ACL: "public-read",
                    ContentType: file.mimetype,
                };

                await s3.send(new PutObjectCommand(params));
                return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
            };

            if (titulo !== undefined) updateFields.titulo = titulo;
            if (autor !== undefined) updateFields.autor = autor;
            if (fecha_publicacion !== undefined) updateFields.fecha_publicacion = fecha_publicacion;
            if (fecha_vencimiento !== undefined) updateFields.fecha_vencimiento = fecha_vencimiento;
            if (categoria_id !== undefined) updateFields.categoria_id = categoria_id;
            if (seccion01 !== undefined) updateFields.seccion01 = seccion01;
            if (seccion02 !== undefined) updateFields.seccion02 = seccion02;

            if (files.imagen_portada) {
                const url = await subirImagenVersionada(
                    files.imagen_portada[0],
                    'portada',
                    currentNoticia.imagen_portada
                );
                updateFields.imagen_portada = url;
                imagenes.imagen_portada = url;
            }

            if (files.imagen01) {
                const url = await subirImagenVersionada(
                    files.imagen01[0],
                    'imagen01',
                    currentNoticia.imagen01
                );
                updateFields.imagen01 = url;
                imagenes.imagen01 = url;
            }

            if (files.imagen02) {
                const url = await subirImagenVersionada(
                    files.imagen02[0],
                    'imagen02',
                    currentNoticia.imagen02
                );
                updateFields.imagen02 = url;
                imagenes.imagen02 = url;
            }

            if (Object.keys(updateFields).length > 0) {
                const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
                const updateQuery = `UPDATE Noticias SET ${setClause} WHERE id = ?`;

                await connection.query(updateQuery, [
                    ...Object.values(updateFields),
                    id
                ]);
            }

            await connection.commit();
            transaction = false;

            res.json({
                mensaje: "Noticia actualizada exitosamente",
                id,
                camposActualizados: Object.keys(updateFields),
                imagenes,
            });
        } catch (error) {
            console.error(error);
            if (transaction) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Error al hacer rollback:", rollbackError);
                }
            }
            res.status(500).json({error: "Error al actualizar la noticia"});
        } finally {
            if (connection) connection.release();
        }
    });
};

exports.eliminarNoticia = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    const {id} = req.params;

    try {
        connection = await pool.getConnection();

        const query = `DELETE FROM Noticias WHERE id = ?`;
        const [result] = await connection.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({error: "Noticia no encontrada"});
        }

        res.json({mensaje: "Noticia eliminada exitosamente"});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al eliminar la noticia"});
    } finally {
        if (connection) connection.release();
    }
}

exports.obtenerNoticias = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    try {
        connection = await pool.getConnection();

        const query = `SELECT id, imagen_portada, titulo, fecha_publicacion, fecha_vencimiento FROM Noticias;`;
        const [rows] = await connection.query(query);

        if (rows.length === 0) {
            return res.status(404).json({error: "No se encontraron noticias"});
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al obtener las noticias"});
    } finally {
        if (connection) connection.release();
    }
}

exports.obtenerDetalleNoticia = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    const {id} = req.params;

    try {
        connection = await pool.getConnection();

        const query = `SELECT * FROM Noticias WHERE id = ${id}`;
        const [rows] = await connection.query(query);

        if (rows.length === 0) {
            return res.status(404).json({error: "No se encontro la noticia"});
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al obtener la noticia"});
    } finally {
        if (connection) connection.release();
    }
}

exports.obtenerCategorias = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    try {
        connection = await pool.getConnection();

        const query = `SELECT id, categoria FROM Categoria`;
        const [rows] = await connection.query(query);

        if (rows.length === 0) {
            return res.status(404).json({error: "No se encontraron categorias"});
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al obtener las categorias"});
    } finally {
        if (connection) connection.release();
    }
}