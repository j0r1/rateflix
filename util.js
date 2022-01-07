const request = require("request");

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
function fixedEncodeURIComponent(str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16);
    });
}

function requestWrapper(func, options)
{
    return new Promise((resolve, reject) => {
        try
        {
            func(options, (err, response, data) => {
                if (err)
                {
                    reject(err);
                    return;
                }
                resolve(data);
            });
        }
        catch(err)
        {
            reject(err);
        }
    });
}

function requestGet(options)
{
    return requestWrapper(request.get, options);
}

function requestPost(options)
{
    return requestWrapper(request.post, options);
}

exports.fixedEncodeURIComponent = fixedEncodeURIComponent;
exports.requestGet = requestGet;
exports.requestPost = requestPost;
