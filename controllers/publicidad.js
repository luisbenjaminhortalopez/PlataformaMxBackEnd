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

exports.agregarPublicidad = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    upload.single("file")(req, res, async (err) => {
        if (err) return res.status(500).json({error: "Error al subir la imagen"});

        const file = req.file;
        if (!file) return res.status(400).json({error: "Archivo no proporcionado"});

        const {nombre_anunciante, fecha_expiracion} = req.body;

        const params = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: `publicidad/${nombre_anunciante}`,
            Body: file.buffer,
            ACL: "public-read",
            ContentType: file.mimetype,
        };

        try {
            connection = await pool.getConnection();

            await s3.send(new PutObjectCommand(params));

            const imagenUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/publicidad/${nombre_anunciante}`;

            const query = `INSERT INTO Publicidad (nombre_anunciante, fecha_expiracion, imagen) VALUES (?, ?, ?)`;
            const [result] = await connection.query(query, [nombre_anunciante, fecha_expiracion, imagenUrl]);

            res.json({
                mensaje: "Publicidad agregada exitosamente",
                id: result.insertId,
                url: imagenUrl,
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({error: "Error al agregar la publicidad"});
        } finally {
            if (connection) connection.release();
        }
    });
};

exports.eliminarPublicidad = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    const {id} = req.params;

    try {
        connection = await pool.getConnection();

        const query = `DELETE FROM Publicidad WHERE id = ?`;
        const [result] = await connection.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({error: "Publicidad no encontrada"});
        }

        res.json({mensaje: "Publicidad eliminada exitosamente"});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al eliminar la publicidad"});
    } finally {
        if (connection) connection.release();
    }
};

exports.actualizarPublicidad = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    upload.single("file")(req, res, async (err) => {
        if (err) return res.status(500).json({error: "Error al subir la imagen"});

        const {id} = req.params;
        const {nombre_anunciante, fecha_expiracion} = req.body;

        const file = req.file;
        let imagenUrl;

        try {
            connection = await pool.getConnection();

            if (file) {
                const [rows] = await connection.query(`SELECT nombre_anunciante FROM Publicidad WHERE id = ?`, [id]);
                if (rows.length === 0) {
                    return res.status(404).json({error: "Publicidad no encontrada"});
                }

                let currentName = rows[0].nombre_anunciante;
                let newName = currentName;

                if (nombre_anunciante && fecha_expiracion) {
                    newName = nombre_anunciante;
                } else {
                    let suffix = 1;

                    while (true) {
                        const existingKey = `publicidad/${newName}`;
                        const headParams = {
                            Bucket: process.env.AWS_BUCKET_NAME,
                            Key: existingKey,
                        };

                        try {
                            await s3.send(new HeadObjectCommand(headParams));
                            suffix++;
                            newName = `${currentName}_v${suffix}`;
                        } catch (err) {
                            if (err.name === "NotFound") {
                                break;
                            } else {
                                throw err;
                            }
                        }
                    }
                }

                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `publicidad/${newName}`,
                    Body: file.buffer,
                    ACL: "public-read",
                    ContentType: file.mimetype,
                };

                await s3.send(new PutObjectCommand(params));
                imagenUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/publicidad/${newName}`;
            }

            const fields = [];
            const values = [];

            if (nombre_anunciante) {
                fields.push("nombre_anunciante = ?");
                values.push(nombre_anunciante);
            }
            if (fecha_expiracion) {
                fields.push("fecha_expiracion = ?");
                values.push(fecha_expiracion);
            }
            if (imagenUrl) {
                fields.push("imagen = ?");
                values.push(imagenUrl);
            }

            if (fields.length === 0) {
                return res.status(400).json({error: "No se proporcionaron campos para actualizar"});
            }

            const query = `UPDATE Publicidad SET ${fields.join(", ")} WHERE id = ?`;
            values.push(id);

            const [result] = await connection.query(query, values);

            if (result.affectedRows === 0) {
                return res.status(404).json({error: "Publicidad no encontrada"});
            }

            res.json({
                mensaje: "Publicidad actualizada exitosamente",
                imagenUrl: imagenUrl || null, // Retorna la URL de la imagen si fue actualizada
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({error: "Error al actualizar la publicidad"});
        } finally {
            if (connection) connection.release();
        }
    });
};

exports.obtenerPublicidad = async (req, res) => {
    const pool = await dbConnection();
    let connection;

    try {
        connection = await pool.getConnection();

        const query = `SELECT * FROM Publicidad`;
        const [rows] = await connection.query(query);

        if (rows.length === 0) {
            return res.status(404).json({error: "No se encontraron publicidades"});
        }

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Error al obtener la publicidad"});
    } finally {
        if (connection) connection.release();
    }
}