const http = require("http");
const fs = require("fs");

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

        // TODO: set mimetype
        response.end(data);
    });
}

function handleMovieRequest(response, request)
{
    console.log(request);
}

function main()
{
    console.log("Server started");
}

server.listen(8000, main);
