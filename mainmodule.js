import { iconImdb, iconRottenTomato, iconRottenAudience, iconTmdb, iconMovieLens } from "./icons.js";

function formatGeneric(ratingInfo, icon, modifier = (m) => m)
{
    let s = `<img src='${icon}' style='height:1em'> `;
    if ("error" in ratingInfo)
        s += "E";
    else
    {
        let scoreFrac = ratingInfo["score"]/ratingInfo["max"];
        s += modifier((scoreFrac*10).toFixed(1));
        s += " ";
    }
    return s;
}

function formatImdb(ratingInfo)
{
    return formatGeneric(ratingInfo, iconImdb);
}

function formatRotten(ratingInfo)
{
    let st = `<img src='${iconRottenTomato}' style='height:1em'> `;
    let sa = `<img src='${iconRottenAudience}' style='height:1em'> `;
    if ("error" in ratingInfo)
        return st + "E";

    let s = "";

    for (let [img, meter] of [ [ st, "tomatometer"] , [ sa, "audience" ] ])
    {
        if (ratingInfo["score"][meter])
        {
            s += img;
            let scoreFrac = ratingInfo["score"][meter]/ratingInfo["max"];
            s += (scoreFrac*10).toFixed(1);

            if (ratingInfo["count"] > 1)
                s += "!";
        }
    }
    return s;
}

function formatMovieLens(ratingInfo)
{
    if (("type" in ratingInfo) && ratingInfo["type"] == "rated")
        return formatGeneric(ratingInfo, iconMovieLens, (r) => `(${r})`);
    return formatGeneric(ratingInfo, iconMovieLens);
}

function formatTmdb(ratingInfo)
{
    return formatGeneric(ratingInfo, iconTmdb);
}

let formatters = {
    "imdb": formatImdb,
    "rotten": formatRotten,
    "tmdb": formatTmdb,
    "movielens": formatMovieLens,
};

class MovieRatings
{
    constructor(name)
    {
        this.name = name;
        this.visible = true;
        this.ratingInfo = null;
        this.ratingsRequested = false;
    }

    getName()
    {
        return this.name;
    }

    setVisible(v)
    {
        this.visible = v;
    }

    getRatingInfo()
    {
        return this.ratingInfo;
    }

    setRatingInfo(r)
    {
        this.ratingInfo = r;
    }

    getRatingsRequested()
    {
        return this.ratingsRequested;
    }

    setRatingsRequested(r)
    {
        this.ratingsRequested = r;
    }

    showRatings(boxart)
    {
        if (!boxart.ratingDiv)
        {
            let ratingDiv0 = document.createElement("div");
            let ratingDiv = document.createElement("div");
            ratingDiv0.appendChild(ratingDiv);
            
            ratingDiv.style.backgroundColor = "#000000a0";
            boxart.ratingDiv = ratingDiv;

            ratingDiv0.style.position = "relative";
            ratingDiv0.style.height = "0px";

            ratingDiv0.style.top = "0px";
            ratingDiv0.style.zIndex = 1000;

            boxart.insertBefore(ratingDiv0, boxart.firstChild);
        }

        boxart.ratingDiv.onclick = (evt) => { 
            evt.preventDefault();
            evt.stopImmediatePropagation();
            this.openRatingUrls(); 
            return false;
        }

        this.formatRatingInfo(boxart.ratingDiv);
    }

    formatRatingInfo(div)
    {
        if (!this.ratingInfo)
        {
            div.innerHTML = "Loading...";
            return;
        }

        let html = "";
        let keys = [];
        for (let rater in this.ratingInfo)
            keys.push(rater);
        keys.sort();

        for (let rater of keys)
            html += formatters[rater](this.ratingInfo[rater]);

        div.innerHTML = html;
    }

    openRatingUrls()
    {
        if (!this.ratingInfo)
        {
            console.log("No rating urls to open yet");
            return;
        }

        let urls = [ ];

        for (let rater in this.ratingInfo)
            if (this.ratingInfo[rater]["url"])
                urls.push(this.ratingInfo[rater]["url"]);

        for (let u of urls)
            openInNewTab(u);
    }
}

// https://stackoverflow.com/a/28374344/2828217
function openInNewTab(href) {
    Object.assign(document.createElement('a'), {
        target: '_blank',
        href: href,
    }).click();
}

let commandConn = null;

class CommandConnection
{
    constructor(url)
    {
        this.url = url;
        this._openWS();
        this.queuedCommands = [];
    }

    destroy()
    {
        if (!this.ws)
            return;

        this.ws.onclose = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws.close();
        this.ws = null;
        console.log("Websocket command connection destroyed");
    }

    _openWS()
    {
        this.ws = new WebSocket(this.url);
        this.ws.onclose = () => { this._onWSClose(); }
        this.ws.onopen = () => { this._sendQueuedCommands(); }
        this.ws.onmessage = (msg) => { this._onMessage(msg); }
    }

    _onWSClose()
    {
        this.ws.onclose = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        this.ws = null;
        setTimeout(() => { 
            console.log("Trying to re-open websocket");
            this._openWS()
        }, 1000); // Wait a bit and try again
    }

    _onMessage(msg)
    {
        this.onRatingResult(JSON.parse(msg.data));
    }

    onRatingResult(data) { } // override this!

    _sendQueuedCommands()
    {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN)
            return;

        for (let q of this.queuedCommands)
        {
            let s = JSON.stringify(q);
            this.ws.send(s);
            console.log("Sending queued " + s);
        }

        this.queuedCommands = [];
    }

    sendCommand(cmd, name)
    {
        // If it's a cancel, see if we can prevent it from even being sent out
        if (cmd === "cancel")
        {
            let newQueuedCommands = [];
            let found = false;
            for (let i = 0 ; i < this.queuedCommands.length ; i++)
            {
                if (this.queuedCommands[i]["name"] !== name)
                    newQueuedCommands.push(this.queuedCommands[i]);
                else
                    found = true;
            }

            this.queuedCommands = newQueuedCommands;

            if (!found) // Didn't remove anything from the queue, add it
                this.queuedCommands.push({"command": "cancel", "name": name});
        }
        else
        {
            this.queuedCommands.push({"command": cmd, "name": name});
        }
        console.log("Command list:");
        console.log(this.queuedCommands);

        this._sendQueuedCommands();
    }
}

function cancelRatingRequests(movies)
{
    for (let m of movies)
    {
        commandConn.sendCommand("cancel", m.getName());
        m.setRatingsRequested(false);
    }
}

function startRatingRequestIfNeeded(movies)
{
    for (let m of movies)
    {
        if (m.getRatingInfo() !== null) // Already have ratings
            continue;

        if (m.getRatingsRequested()) // Already signalled rating request
            continue;

        commandConn.sendCommand("lookup", m.getName());
        m.setRatingsRequested(true);
    }
}

// https://stackoverflow.com/a/5354536/2828217
function checkVisible(elm)
{
    let rect = elm.getBoundingClientRect();
    let viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

class PopupState
{
    constructor() { this.visible = false; }
    updateStatus(visibleMovie)
    {
        if (visibleMovie === null)
        {
            if (this.visibleMovie == null)
                return;
            this.visibleMovie = null;
        }
        else
        {
            if (this.visibleMovie !== null)
            {
                // Make sure we have the most recent movie name
                this.visibleMovie = visibleMovie;
                return;
            }

            this.visibleMovie = visibleMovie;
        }

        this.onPopupVisibilityChanged();
    }

    onPopupVisibilityChanged()
    {
        if (this.visibleMovie)
            document.onkeypress = (e) => this.onKeyPress(e);
        else
            document.onkeypress = null;
    }

    onKeyPress(evt)
    {
        if (!evt)
            return;
        if (!this.visibleMovie)
            return;

        if (!(this.visibleMovie in allMovies))
            return;

        if (evt.key === "d") // delete entry
            allMovies[this.visibleMovie].setRatingInfo(null);
        else if (evt.key === "r") // show all rating info, for debugging
        {
            let name = this.visibleMovie;
            let ratings = allMovies[name].getRatingInfo();
            let tab = window.open('about:blank', '_blank');
            tab.document.write(`
<!doctype html>
<html lang="en">
   <body>
       <pre>
Title: '${name}'
${JSON.stringify(ratings, null, 2)}
       </pre>
   </body>
</html>`);
            tab.document.close(); 
        }
    }
};

function popupVisibilityChanged(visible)
{
    console.log("Popup status changed to " + visible);
}

let popupState = new PopupState();

let allMovies = { }
let visibleMovies = []

function processResult(r)
{
    console.log("Got result");
    console.log(r);
    if (r.name in allMovies)
        allMovies[r.name].setRatingInfo(r.results);
}

function visibleMoviesCheck()
{
    let noLongerVisible = new Map();
    // Clear list of visible movies
    for (let m of visibleMovies)
    {
        m.setVisible(false);
        noLongerVisible.set(m, true);
    }
    visibleMovies = []

    let popupMovie = null;

    // Build new list of visible movies
    let images = document.querySelectorAll("img.previewModal--boxart, img.boxart-image");
    for (let i of images)
    {
        let par = i.parentElement;
        let divToAddTo = null;
        let name = null;
        let hidden = true;

        if (i.className == "previewModal--boxart")
        {
            name = i.getAttribute("alt");
            divToAddTo = par.parentElement.parentElement;
            popupMovie = name;
        }
        else
        {
            divToAddTo = par.parentElement.parentElement;

            let anchor = par.parentElement;
            hidden = anchor.getAttribute("aria-hidden");
            name = anchor.getAttribute("aria-label");
        }
            
        if (i.className === "previewModal--boxart" || hidden === "false")
        {
            if (checkVisible(i))
            {
                let m = null;
                if (name in allMovies)
                    m = allMovies[name];
                else
                {
                    m = new MovieRatings(name);
                    allMovies[name] = m;
                }
                m.setVisible(true);

                visibleMovies.push(m);
                if (noLongerVisible.has(m))
                    noLongerVisible.delete(m);

                m.showRatings(divToAddTo);
            }
        }
    }

    cancelRatingRequests(noLongerVisible.keys());
    startRatingRequestIfNeeded(visibleMovies);

    saveToLocalStorage();
    popupState.updateStatus(popupMovie);

    /*
    // Debug: list visible movies
    let s = "";
    for (let m of visibleMovies)
        s += m.getName() + ":";
    console.log("Visible:" + s);

    // List no longer visible:
    s = "";
    for (let m of noLongerVisible.keys())
        s += m.getName() + ":";
    if (s.length > 0)
        console.log("No longer visible:" + s);
    */
}

let previousSaveTime = 0;
function saveToLocalStorage()
{
    let now = performance.now();
    if (now - previousSaveTime < 5000) // save every five seconds
        return;

    previousSaveTime = now;

    let cache = { };
    for (let name in allMovies)
    {
        let r = allMovies[name].getRatingInfo();
        if (!r)
            continue;

        cache[name] = r;
    }

    localStorage["rateFlixCache"] = JSON.stringify(cache);
    console.log("Saved rating cache");
}

function loadLocalStorage()
{
    let cachedMoviesRatings = localStorage["rateFlixCache"];
    if (!cachedMoviesRatings)
        return;
    cachedMoviesRatings = JSON.parse(cachedMoviesRatings);

    allMovies = { }
    for (let name in cachedMoviesRatings)
    {
        let ratingInfo = cachedMoviesRatings[name];
        if (!ratingInfo)
            continue;

        let m = new MovieRatings(name);
        m.setRatingInfo(ratingInfo);
        m.setVisible(false);

        allMovies[name] = m;
    }
}

function main()
{
    console.log("main(module)");
    if (window.rateFlixTimer !== undefined)
    {
        clearInterval(window.rateFlixTimer);
        console.log("Cleared old timer");
    }

    if (window.rateFlixConn !== undefined)
    {
        window.rateFlixConn.destroy();
        console.log("Cleared old connection");
    }

    window.rateFlixTimer = setInterval(visibleMoviesCheck, 500);

    commandConn = new CommandConnection("ws://localhost:" + window.rateFlixPort);
    commandConn.onRatingResult = processResult;
    window.rateFlixConn = commandConn;

   loadLocalStorage(); 
}

console.log("Main module");
main();
