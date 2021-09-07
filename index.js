const express = require('express')
const app = express()
//const port = process.argv[2];
const port = 3000;
const cors = require('cors');
const shellExec = require('shell-exec');
const shell = require('shelljs');
const nodemailer = require('nodemailer');
const bodyparser = require('body-parser')
const loadbalance = require('loadbalance')
var path = require('path')
var fs = require('fs')
var morgan = require('morgan')
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})
const axios = require('axios');
var servers = ["http://localhost:4000/",
    "http://localhost:4001/",
    "http://localhost:4002/"]
var maxErrors = 3;    
var portNew = 4003;
var engine = loadbalance.roundRobin(servers)
var count = 0;
app.use(express.json())
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({ extended: true }))
app.use(cors())
app.use(morgan('combined', {stream: accessLogStream}))
app.use(require('express-status-monitor')());

app.get('/', (req, res) => {
    loadBalancer(res);
})

app.post('/addServer', (req, res) => {    
    shell.exec(`sh bash.sh ${portNew}`)
    axios.get("http://localhost:"+portNew+"/")
        .then(function (response) {            
            console.log("Servidor agregado: ")
            console.log('>'+response.data+'<')
            servers.push("http://localhost:"+portNew+"/")
            engine = loadbalance.roundRobin(servers)
            maxErrors = maxErrors + 1
            res.send("Servidor correctamente agregado"+"http://localhost:"+portNew+"/")
            console.log("Servers: " + servers)
            portNew++;
            var now = new Date();
            var date = now.getDate()+"/"+(now.getMonth()+1)+"/"+now.getFullYear();
            var hour = now.getHours()+":"+now.getMinutes()+":"+now.getSeconds();
            var report = date+"-"+hour+"-"+servers;
            shell.exec(`sh write_report.sh ${report}`)
        })
        .catch(function (error) {            
            var txt = "Servidor: " + "http://localhost:"+portNew+"/" + " no disponible";
            res.send(txt)
            console.log(txt)
           
        })
    
})

function loadBalancer(res) {
    if (count < maxErrors) {
        var srv = engine.pick();
        console.log(srv + " ha recibido peticion");
        axios.get(srv)
            .then(function (response) {
                axios.get(srv+"saveServer", {
                    params: {
                      name: srv
                    }
                  })
                //console.log("count: " + count)
                count = 0;
                res.send(srv)
                var now = new Date();
            var date = now.getDate()+"/"+(now.getMonth()+1)+"/"+now.getFullYear();
            var hour = now.getHours()+":"+now.getMinutes()+":"+now.getSeconds();
            var report = date+"-"+hour+"-"+srv;
            
                shell.exec(`sh write_report-servidor.sh ${report}`)

            }).catch(function (error) {
                console.log("Error")
                loadBalancer(res);
            })

            .catch(function (error) {
                var txt = "Servidor: " + srv + " no disponible";
                console.log(txt)
                count = count + 1;
                //console.log("count: " + count)
                mail(txt);
                loadBalancer(res);
            })

    } else {
        res.send('Error')
        console.log("Servidores fuera de servicio")
        count = 0;
    }

}

function mail(data) {
    
    var trasnporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
            user: 'pruebadistribuidos12',
            pass: 'Distribuidos2021'
        }
    });
    var infoMessage = {
        from: 'pruebadistribuidos12@gmail.com',
        to: 'lorena.rioss@uptc.edu.co',
        subject: 'Falla en el sistema',
        text: data
    };
    trasnporter.sendMail(infoMessage, function (error, info) {
        if (error) {
            console.log("error enviando correo");
            console.log(error);
        } else {
            console.log("Correo enviado");
        }
    });
}

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})