const express = require('express');
const cors = require('cors');
const path = require('path');

const { dbConnection } = require('../database/config');

class Server {

    constructor() {
        this.app  = express();
        this.port = process.env.PORT;

        this.authPath = '/auth';
        this.noticiasPath = '/noticias';
        this.publicidadPath = '/publicidad';

        void this.conectarDB();

        this.middlewares();

        this.routes();
    }

    async conectarDB() {
        await dbConnection();
    }

    middlewares() {
        this.app.use( cors() );

        this.app.use( express.json() );

        this.app.use( express.static('public') );

        this.app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
    }

    routes() {
        this.app.use( this.authPath, require('../routes/auth'));
        this.app.use( this.noticiasPath, require('../routes/noticias'));
        this.app.use( this.publicidadPath, require('../routes/publicidad'));
    }

    listen() {
        this.app.listen( this.port, () => {
            console.log('- Local: ' + 'http://localhost:' + this.port + '/');
        });
    }
}

module.exports = {
    Server
}
