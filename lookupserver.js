const http = require("http");
const fs = require("fs");
const { Worker } = require('worker_threads');
const websocket = require("websocket"); // npm install websocket

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "GET")
        serveFile(res, "." + req.url)
    else
    {
        res.statusCode = 505;
        res.end("Invalid method " + req.method);
    }
});

const wsServer = new websocket.server({
    httpServer: server,
    autoAcceptConnections: false
});

let connection = null;
let queuedResults = [];

wsServer.on("request", (request) => {
    // TODO: check origin, reject request if needed

    // 'null' means no specific subprotocol
    let conn = request.accept(null, request.origin);
    console.log("Connection from " + conn.remoteAddress);

    if (connection)
        connection.close();

    connection = conn;

    conn.on("message", (msg) => {
        if (msg.type === 'binary')
        {
            console.log("Can't handle binary data, closing connection");
            conn.close();
        }
        else
        {
            try
            {
                let cmdDict = JSON.parse(msg.utf8Data);
                processCommand(cmdDict["command"], cmdDict["name"]);
            }
            catch(err)
            {
                console.log("Error processing message " + msg.utf8Data + ", closing connection");
                conn.close();
            }
        }
    });
    conn.on("close", () => {
        console.log("Disconnected " + conn.remoteAddress);
        if (connection === conn)
            connection = null;
    });

    // Send queued results
    for (let r of queuedResults)
        conn.send(r);
    queuedResults = [];
})

function preprocessFileName(fileName)
{
    if (fileName === "./")
        fileName = "./index.html";

    let q = fileName.indexOf("?");
    if (q >= 0)
        fileName = fileName.substring(0, q);

    return fileName;
}

const mimeTypes = { ".html": "text/html", ".js": "text/javascript" }

function setMimeType(response, fileName)
{
    let isset = false;
    for (let suffix in mimeTypes)
    {
        if (fileName.endsWith(suffix))
        {
            response.setHeader("Content-type", mimeTypes[suffix]);
            isset = true;
            break;
        }
    }
    if (!isset)
        response.setHeader("Content-type", "text/plain");
}

function serveFile(response, fileName)
{
    fileName = preprocessFileName(fileName);
    setMimeType(response, fileName);

    console.log("Reading file " + fileName);
    fs.readFile(fileName, (err, data) => {
        if (err)
        {
            response.statusCode = 505;
            response.end("Error: " + err);
            return;
        }

        response.end(data);
    });
}

let workers = [ ]
let requestsToHandle = [];

function setupWorkers(N)
{
    for (let i = 0 ; i < N ; i++)
    {
        let w = new Worker("./lookupworker.js");
        let d = {
            "worker": w, 
            "busy": false,
        };

        w.on("message", (msg) => { 
            
            d.busy = false;

            sendResult(msg);

            // Check if there's a queued request

            if (requestsToHandle.length > 0)
            {
                let r = requestsToHandle.shift();
                d.busy = true;
                d.worker.postMessage(r);
                console.log("Posting queued request: "  + r);
            }
        });

        workers.push(d);
    }
}

let numWorkers = parseInt(process.argv[3]);
if (numWorkers < 1 || numWorkers > 32 || isNaN(numWorkers))
    throw "Invalid number of workers";
console.log(`Using ${numWorkers} workers`);

setupWorkers(numWorkers);
/*setInterval(() => {
    let busy = [];
    for (let w of workers)
        busy.push(w.busy);
    console.log(busy);
}, 2000);
*/

setInterval(() => {
    console.log("Requests to handle:");
    console.log(requestsToHandle);
    console.log("Queued results:");
    console.log(queuedResults);
},2000);

function processCommand(command, movieName)
{
    console.log(`${command}: ${movieName}`);

    if (command === "lookup")
    {
        let found = false;
        for (let w of workers)
        {
            if (!w.busy)
            {
                found = true;
                w.busy = true;
                w.worker.postMessage(movieName);
                console.log("Started lookup for " + movieName);
                break;
            }
        }

        if (!found) // add to queue
        {
            if (!(movieName in requestsToHandle))
                requestsToHandle.push(movieName);
        }
    }
    else if (command === "cancel")
    {
        let count = 0;
        for (let i = 0; i < requestsToHandle.length; i++)
        { 
            if (requestsToHandle[i] === movieName)
            {
                requestsToHandle.splice(i, 1); 
                count++;
            }
        }
        console.log(`Removed ${count} instances of '${movieName}' from requestsToHandle`);
    }
    else
    {
        console.log("Unknown command");
    }
}

function sendResult(msg)
{
    if (connection)
        connection.send(msg);
    else
        queuedResults.push(msg);
}

function main()
{
    console.log("Server started on port " + serverPort);
}

let serverPort = parseInt(process.argv[2]);
server.listen(serverPort, main);



