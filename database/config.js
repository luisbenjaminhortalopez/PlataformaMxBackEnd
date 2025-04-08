require('dotenv').config();
const mysql = require('mysql2/promise');
let pool;

const initializePool = () => {
    pool = mysql.createPool({
        host: process.env.DB_HOSTNAME,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        waitForConnections: true,
        connectionLimit: 100,
        queueLimit: 0,
        connectTimeout: 10000,
    });
};

initializePool();

pool.on('error', (err) => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.error('Database connection lost. Reconnecting...');
        initializePool();
    } else {
        throw err;
    }
});

const dbConnection = async () => {
    try {
        return pool;
    } catch (error) {
        console.log(error);
        throw new Error('Error al conectar a la base de datos');
    }
};

module.exports = {
    dbConnection
};