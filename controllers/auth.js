const {dbConnection} = require("../database/config");

exports.login = async (req, res) => {
    const {username, password} = req.body;
    const pool = await dbConnection();
    let connection;

    try {
        connection = await pool.getConnection();
        const [usuario] = await connection.query(`SELECT id FROM UsuariosAdministrador WHERE username = ? AND password = ?`, [username, password]);

        if (usuario.length === 0) {
            return res.status(401).json({
                msg: "Usuario o contraseña incorrectos",
            });
        }

        //const token = jwt.sign({id: usuario[0].id}, process.env.JWT_SECRET, {expiresIn: '1h'});

        res.json({
            msg: "Login exitoso",
            usuario: usuario[0],
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Error en el servidor",
        });
    } finally {
        if (connection) connection.release();
    }
}