
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

    showRatings(boxart, fixed)
    {
        if (!boxart.ratingDiv)
        {
            let ratingDiv = document.createElement("div");
            ratingDiv.style.position = (fixed)?"fixed":"relative";
            ratingDiv.style.backgroundColor = "#000000a0";
            ratingDiv.style.top = "0px";
            boxart.ratingDiv = ratingDiv;
            boxart.appendChild(ratingDiv);
        }
        
        if (!this.ratingInfo)
            boxart.ratingDiv.innerHTML = "Loading...";
        else
        {
            let html = "";
            for (let rater in this.ratingInfo)
                html += `${rater}: ${this.ratingInfo[rater]}<br>`;
            boxart.ratingDiv.innerHTML = html;
        }
    }
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

    // Build new list of visible movies
    let images = document.querySelectorAll("img.previewModal--boxart, img.boxart-image");
    for (let i of images)
    {
        let boxart = i.parentElement;
        let anchor = boxart.parentElement;
        let name = null;
        let hidden = anchor.getAttribute("aria-hidden");

        if (i.className == "previewModal--boxart")
            name = i.getAttribute("alt");
        else
            name = anchor.getAttribute("aria-label");
            
        if (i.className == "previewModal--boxart" || hidden === "false")
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

                m.showRatings(boxart, i.className === "previewModal--boxart");
            }
        }
    }

    cancelRatingRequests(noLongerVisible.keys());
    startRatingRequestIfNeeded(visibleMovies);

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

    window.rateFlixTimer = setInterval(visibleMoviesCheck, 1000);

    commandConn = new CommandConnection("ws://localhost:" + window.rateFlixPort);
    commandConn.onRatingResult = processResult;
    window.rateFlixConn = commandConn;

    
}

console.log("Main module");
main();
