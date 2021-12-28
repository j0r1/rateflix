const http = require("http");
const fs = require("fs");
const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;

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

        response.end('{ "imdb": 99, "rotten": 98 }');
    });
}

function main()
{
    console.log("Server started");
}

//server.listen(8000, main);

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

function lookupIMDB(name)
{
    return new Promise((resolve, reject) => {
        let url = "https://www.imdb.com/find?q=" + fixedEncodeURIComponent(name) + "&s=tt&exact=true";
        //console.log(url);
        
        fetch(url)
        .then((response) => response.text())
        .then((text) => {
            try
            {
                let dom = new JSDOM(text);
                let td = dom.window.document.querySelector("td.result_text");
                let a = td.querySelector("a");
                let titleHref = a.getAttribute("href");

                let url = "https://www.imdb.com/" + titleHref ;
                //console.log(url);

                fetch(url)
                .then((response) => response.text())
                .then((text) => {
                    try
                    {
                        let dom = new JSDOM(text);
                        let divs = dom.window.document.querySelectorAll("div");
                        let div = null;

                        for (let d of divs)
                        {
                            if (d.getAttribute("data-testid") === "hero-rating-bar__aggregate-rating__score")
                            {
                                div = d;
                                break;
                            }
                        }

                        let span = div.querySelector("span");
                        resolve(span.textContent);
                    }
                    catch(err)
                    {
                        reject("Error getting imdb score from page " + url);
                        console.log(err);
                    }
                })
                .catch((err) => {
                    reject("Error fetching imdb title url " + url);
                    console.log(err);
                })
            }
            catch(err)
            {
                reject("Error getting imdb title url from " + url);
                console.log(err);
            }
        })
        .catch((err) => {
            reject("Error fetching imdb page " + url);
            console.log(err);
        })
    })
}

lookupIMDB("Don't look up")
.then(score => console.log("Score: " + score))
.catch(err => console.log("Error: " + err))
