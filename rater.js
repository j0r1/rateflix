class Rater
{
    constructor(name)
    {
        this.name = name;
    }

    getName()
    {
        return this.name;
    }

    async init()
    {
        throw "'Rater.init' must be implemented in child class";
    }

    async lookup(name) // Returns [ rating, url ]
    {
        throw [ "'Rater.lookup' must be implemented in child class", null ];
    }
};

exports.Rater = Rater
