const { WorkerData, parentPort } = require('worker_threads')
const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;
const he = require("he"); // npm install he

parentPort.on("message", (name) => {
    console.log("Looking up: " + name);

    let movieResults = { "name": name, "results": { } };
    let results = movieResults.results;

    let imdbProm = lookupIMDB(name)
    .then((score) => {
        results["imdb"] = score;
    })
    .catch((err) => {
        results["imdb"] = err;
    })

    let rottenProm = lookupRottenTomatoes(name)
    .then((score) => {
        results["rotten"] = score;
    })
    .catch((err) => {
        results["rotten"] = err;
    })
    
    Promise.allSettled([imdbProm, rottenProm]).then(() => {
        parentPort.postMessage(JSON.stringify(movieResults));
        console.log(movieResults);
    });
})

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

