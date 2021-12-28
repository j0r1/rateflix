const http = require("http");
const fs = require("fs");
const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;
const he = require("he"); // npm install he

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

        let results = { };

        let imdbProm = lookupIMDB(postData)
        .then((score) => {
            results["imdb"] = score;
        })
        .catch((err) => {
            results["imdb"] = err;
        })

        let rottenProm = lookupRottenTomatoes(postData)
        .then((score) => {
            results["rotten"] = score;
        })
        .catch((err) => {
            results["rotten"] = err;
        })
        
        Promise.allSettled([imdbProm, rottenProm]).then(() => {
            response.end(JSON.stringify(results));
            console.log("Results for " + postData);
            console.log(results);
        });
    });
}

function main()
{
    console.log("Server started");
}

server.listen(8000, main);

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
        console.log(url);
        
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
                console.log(url);

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

function lookupRottenTomatoes(name)
{
    return new Promise((resolve, reject) => {

        let url = "https://www.rottentomatoes.com/search?search=" + fixedEncodeURIComponent(name)
        console.log(url);

        fetch(url, {
            headers: { 
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
            }
        })
        .then((response) => response.text())
        .then((text) => {

            try
            {
                let dom = new JSDOM(text);
                let results = dom.window.document.querySelectorAll("search-page-media-row");
                let url = null;
                let count = 0;
                for (let r of results)
                {
                    let img = r.querySelector("img");
                    let txt = he.decode(img.getAttribute("alt"));
                    if (txt.toLowerCase() == name.toLowerCase()) // Use the first one with complete match
                    {
                        if (!url)
                            url = img.parentNode.getAttribute("href");
                        count++;
                    }
                }

                // TODO: Check if link found
                console.log(url);

                fetch(url, {
                    headers: { 
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                    }
                })
                .then((response) => response.text())
                .then((text) => {

                    //console.log(text);

                    try
                    {
                        let dom = new JSDOM(text);
                        let scoreBoard = dom.window.document.querySelector("score-board");
                        let tm = "";
                        let aud = "";
                        if (scoreBoard)
                        {
                            aud = scoreBoard.getAttribute("audiencescore");
                            tm = scoreBoard.getAttribute("tomatometerscore");
                        }
                        else
                        {
                            let spans = dom.window.document.querySelectorAll("span");

                            for (let s of spans)
                            {
                                let dataqa = s.getAttribute("data-qa");
                                if (dataqa === "tomatometer")
                                    tm = s.textContent.trim();
                                else if (dataqa === "audience-score")
                                    aud = s.textContent.trim();
                            }
                        }
                        let result = "TM: " + tm + ", AUD: " + aud;
                        if (count > 1)
                            result += ` (${count} > 1!)`;
                        resolve(result);
                    }
                    catch(err)
                    {
                        reject("Error getting rotten tomatoes scores from page " + url);
                        console.log(err);
                    }
                })
                .catch((err) => {
                    reject("Error rotten tomatoes title url " + url);
                    console.log(err);
                })
            }
            catch(err)
            {
                reject("Error rotten tomatoes title url from " + url);
                console.log(err);
            }
        })
        .catch((err) => {
            reject("Error fetching rotten tomatoes page " + url);
            console.log(err);
        })
    });
}

//lookupRottenTomatoes("The IT Crowd")
//.then(score => console.log("Score: " + score))
//.catch(err => console.log("Error: " + err))

