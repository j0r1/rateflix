const fetch = require("node-fetch"); // npm install node-fetch@2.0
const jsdom = require("jsdom"); // npm install jsdom
const { JSDOM } = jsdom;
const he = require("he"); // npm install he
const util = require("./util.js");
const rater = require("./rater.js");

class RottenTomatoesRater extends rater.Rater
{
    constructor(name)
    {
        super("rotten");
    }

    getMax()
    {
        return 100.0;
    }

    async init()
    {
        return true;
    }

    async lookup(name)
    {
        let url = null;
        let text = null;

        try
        {
            url = "https://www.rottentomatoes.com/search?search=" + util.fixedEncodeURIComponent(name);
            let response = await fetch(url, {
                headers: { 
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                }});
            text = await response.text();
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error loading search page", "url": url };
        }

        let movieUrl = null;
        let count = 0;

        try
        {
            let dom = new JSDOM(text);
            let results = dom.window.document.querySelectorAll("search-page-media-row");
            for (let r of results)
            {
                let img = r.querySelector("img");
                let txt = he.decode(img.getAttribute("alt"));
                if (txt.toLowerCase() == name.toLowerCase()) // Use the first one with complete match
                {
                    if (!movieUrl)
                        movieUrl = img.parentNode.getAttribute("href");
                    count++;
                }
            }
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error looking for movie url in search page", "url": url };
        }
        
        if (!movieUrl)
            throw { "error": "No movie url found in page", "url": url };

        try
        {
            let response = await fetch(movieUrl, {
                    headers: { 
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                    }
                });

            text = await response.text();
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error loading movie url", "url": movieUrl };
        }

        try
        {
            let dom = new JSDOM(text);
            let scoreBoard = dom.window.document.querySelector("score-board");
            let tm = null;
            let aud = null;
            if (scoreBoard)
            {
                aud = parseFloat(scoreBoard.getAttribute("audiencescore"));
                tm = parseFloat(scoreBoard.getAttribute("tomatometerscore"));
            }
            else
            {
                let spans = dom.window.document.querySelectorAll("span");

                for (let s of spans)
                {
                    let dataqa = s.getAttribute("data-qa");
                    if (dataqa === "tomatometer")
                        tm = parseFloat(s.textContent.trim());
                    else if (dataqa === "audience-score")
                        aud = parseFloat(s.textContent.trim());
                }
            }
            let result = {
                "score": { "tomatometer": tm, "audience": aud },
                "numhits": count,
                "url": movieUrl
            }

            return result;
        }
        catch(err)
        {
            console.log(err);
            throw { "error": "Error getting rotten tomatoes scores from page", "url": movieUrl };
        }

    }
}

/*
async function main()
{
    let rater = new RottenTomatoesRater();
    await rater.init();

    let ratingInfo = await rater.lookup("heat");
    console.log("Rating info:");
    console.log(ratingInfo);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })
*/

exports.RottenTomatoesRater = RottenTomatoesRater;
