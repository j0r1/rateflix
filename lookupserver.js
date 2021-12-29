const http = require("http");
const fs = require("fs");
const { Worker } = require('worker_threads');

const server = http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.method === "GET")
        serveFile(res, "." + req.url)
    else if (req.method === "POST")
        handleMovieRequest(res, req);
    else
    {
        res.statusCode = 505;
        res.end("Invalid method " + req.method);
    }
});

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
            "response": null
        };

        w.on("message", (msg) => { 
            
            let response = d.response;
            d.busy = false;
            d.response = null;

            response.end(msg);

            // Check if there's a queued request

            if (requestsToHandle.length > 0)
            {
                let r = requestsToHandle.shift();
                d.busy = true;
                d.response = r.response;
                d.worker.postMessage(r.name);
                console.log("Posting queued request: "  + r.name);
            }
        });

        workers.push(d);
    }
}

setupWorkers(8);
setInterval(() => {
    let busy = [];
    for (let w of workers)
        busy.push(w.busy);
    console.log(busy);
}, 2000);

function handleMovieRequest(response, request)
{
    let postParts = [ ];
    request.on("data", (data) => { 
        postParts.push(data);
    });
    request.on("end", () => {
        let totalData = Buffer.concat(postParts);
        let postData = totalData.toString();

        console.log("Received:");
        console.log(postData);

        // Look for an available worker
        let found = false;
        for (let w of workers)
        {
            if (!w.busy)
            {
                found = true;
                w.busy = true;
                w.worker.postMessage(postData);
                w.response = response;
                break;
            }
        }

        if (!found) // add to queue
            requestsToHandle.push({ "name": postData, "response": response })
    });
}

function main()
{
    console.log("Server started");
}

server.listen(8000, main);



