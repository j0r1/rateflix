const request = require("request");
const rater = require("./rater.js");
const fs = require("fs");
const util = require("./util.js");

class MovieLensRater extends rater.Rater
{
    constructor()
    {
        super("movielens");
        this.jar = request.jar();
    }

    init()
    {
        return new Promise((resolve, reject) => {
            fs.readFile("movielensaccount.json", (err, data) => {
                if (err)
                {
                    reject(err);
                    return;
                }

                try
                {
                    let dict = JSON.parse(data); // See if it's valid json

                    if (!("userName" in dict))
                        throw "No 'userName' found in movielensaccount.json";
                    if (!("password" in dict))
                        throw "No 'password' found in movielensaccount.json";

                    request.get({
                        "url": "https://movielens.org/login",
                        "jar": this.jar,
                        "headers": { 
                            "Content-Type": "application/json",
                            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                        },
                    }, (err, response, data) => {
                        if (err)
                        {
                            reject(err);
                            return;
                        }

                        request.post({
                            "url": "https://movielens.org/api/sessions",
                            "jar": this.jar,
                            "method": "post",
                            "headers": { 
                                "Content-Type": "application/json",
                                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                            },
                            "body": JSON.stringify(dict),
                        }, (err, response, data) => {
                            if (err)
                            {
                                reject(err);
                                return;
                            }
                            resolve();
                        });
                    });
                }
                catch(err)
                {
                    reject(err);
                }
            });
        });
    }

    lookup(name)
    {
        return new Promise((resolve, reject) => {
            let url = "https://movielens.org/api/movies/explore?q=" + util.fixedEncodeURIComponent(name);
            request.get({
                "url": url,
                "jar": this.jar,
                "method": "get",
                "headers": { 
                    "Accept": "application/json, text/plain, */*",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                },
            }, (err, response, data) => {
                if (err)
                {
                    reject(["Error loading search page", url]);
                    return;
                }

                try
                {
                    let results = JSON.parse(data);
                    results = results["data"]["searchResults"];

                    let movieId = null;
                    for (let r of results)
                    {
                        if (r["movie"]["title"].toLowerCase().trim() == name.toLowerCase().trim())
                        {
                            movieId = r["movieId"];
                            break;
                        }
                    }

                    if (movieId === null)
                        throw "No matching movie name found";
                    
                    let url = "https://movielens.org/api/movies/" + movieId;
                    request.get({
                        "url": url,
                        "jar": this.jar,
                        "method": "get",
                        "headers": { 
                            "Accept": "application/json, text/plain, */*",
                            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
                        },
                    }, (err, response, data) => {
                
                        if (err)
                        {
                            console.log(err);
                            reject(["Can't get movie page", url]);
                        }

                        try
                        {
                            let results = JSON.parse(data);
                            let movieUserData = results["data"]["movieDetails"]["movieUserData"];
                            let rating = movieUserData["rating"];
                            let pred = movieUserData["prediction"];

                            let s = null;
                            if (rating === null)
                                s = `${pred.toFixed(2)}, predicted`;
                            else
                                s = `${rating}, rated`;
                            resolve([s, url]);
                        }
                        catch(err)
                        {
                            console.log(err);
                            reject(["Can't get rating from movie page", url]);
                        }
                    });
                }
                catch(err)
                {
                    console.log(data);
                    console.log(err);
                    reject(["Unable to find movie on search page", url]);
                }
            });
        });
    }
}

async function main()
{
    let rater = new MovieLensRater();
    await rater.init();

    let [ rating, url ] = await rater.lookup("The prestige");
    console.log("Rating: " + rating);
    console.log("Url: " + url);
}

main()
.then(() => console.log("Finished"))
.catch((e) => { console.log("Error in main:"); console.log(e); })

exports.MovieLensRater = MovieLensRater;
