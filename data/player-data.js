/*
 * Projections CSV File Format:
 * id,last,first,pos,pos1,team,patt,pcmp,pyds,p300,ptds,pint,ratt,ryds,r100,rtds,rec,cyds,c100,ctds,fum,FGM,FGA,EPM,EPA,TD,FF,FR,INT,Sack,Saf,yds,pts,iInt,iPD,iTck,iAst,iSack,iFF,iFR,iTD,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,GP,age,exp,kryd,krtd,pryd,prtd
 *
 * ADP CSV File Format:
 * lname,fname,pos,team,adp_consensus,adp_expert,adp_mfl,adp_mock,adp_cbs,adp_mag,adp_consensus_ppr,adp_expert_ppr,adp_mfl_ppr,adp_mock_ppr
 *
 * DEF PTS/Game Equation: f(x) = -0.372x + 7.76
 */

var parse = require('csv/node_modules/csv-parse');
var fs = require('fs');

var results = [];
var adpSorted = [];
function Result(pos, name, team, total) {
    this.pos = pos;
    this.name = name;
    this.team = team;
    this.total = parseFloat(total).toFixed(2);
    this.adp = 1000;
};
Result.prototype.setAdp = function setAdp(adp) {
    this.adp = adp;
};
Result.prototype.setTotal = function setTotal(total) {
    this.total = total.toFixed(2);
};

var getFullName = function(firstName, lastName) {
    return firstName + ' ' + lastName;
};

var totalSort = function(a, b){
    return b.total - a.total;
};

var adpSort = function(a, b){
    return a.adp - b.adp;
};

var parser = parse({delimiter: ',', columns: true, auto_parse: true}, function(err, data) {
    data = data.filter(function (item) {
        var pos = item['pos'];
        return pos === 'QB'
            || pos === 'RB'
            || pos === 'WR'
            || pos === 'TE'
            || pos === 'DEF'
            || pos === 'PK';
    });

    for (var i in data) {
        var item = data[i];

        var pos = item['pos'];
        var total;
        if (pos === 'DEF') {
            total =
                (item['TD'] * 6)
                + (item['FR'] * 2)
                + (item['INT'] * 2)
                + (item['Sack'] * 1)
                + (item['Saf'] * 2)
                + ((19.5 - (item['pts'] / 16)) * 6);
        } else if (pos === 'PK') {
            total =
                (item['FGM'] * 3)
                + ((item['FGA'] - item['FGM']) * -1)
                + (item['EPM'] * 1)
                + ((item['EPA'] - item['EPM']) * -1);
        } else {
            total =
                (item['pyds'] / 25)
                + (item['ptds'] * 6)
                + (item['pint'] * -2)
                + (item['ryds'] / 10)
                + (item['rtds'] * 6)
                + (item['rec'] * .5)
                + (item['cyds'] / 10)
                + (item['ctds'] * 6)
                + (item['fum'] * -2);
        }
        results[pos] = results[pos] || [];

        var result = new Result(pos, getFullName(item['first'], item['last']), item['team'], total);
        results[pos].push(result);
        if (pos == 'RB' || pos == 'WR') {
            results['FLEXRW'] = results['FLEXRW'] || [];
            results['FLEXRW'].push(result);
        }
        if (pos == 'WR' || pos == 'TE') {
            results['FLEXWT'] = results['FLEXWT'] || [];
            results['FLEXWT'].push(result);
        }
    };

    for (var i in data) {
        var item = data[i];

        var tds = item['prtd'] + item['krtd'];
        if (tds > 0) {
            var team = item['team'];
            for (var i in results['DEF']) {
                if (results['DEF'][i].team === team) {
                    results['DEF'][i].setTotal(parseFloat(results['DEF'][i].total) + (tds * 6));
                }
            }
        }
    };

    for (var pos in results) {
        results[pos].sort(totalSort);
    };

    var adpParser = parse({delimiter: ',', columns: true, auto_parse: true}, function(err, data) {
        var setAdpForPlayer = function(player, adp) {
            for (var pos in results) {
                for (var i in results[pos]) {
                    if (results[pos][i].name === player) {
                        results[pos][i].setAdp(adp);
                        return results[pos][i];
                    }
                }
            }
        };

        for (var i in data) {
            var item = data[i];

            var player = getFullName(item['fname'], item['lname']);
            var adp = item['adp_consensus_ppr'] || 1000;
            adpSorted.push(setAdpForPlayer(player, adp));
        };
        adpSorted.sort(adpSort);
    });
    fs.createReadStream(__dirname + '/adp.csv').pipe(adpParser);
});
fs.createReadStream(__dirname + '/projections.csv').pipe(parser);

var bestAvailable = function bestAvailable(picks) {
    function ResultEntry(position, delta, string) {
        this.position = position;
        this.delta = delta.toFixed(2);
        this.string = string;
    }
    var result = [];
    var adp = adpSorted[picks]['adp'];

    var nextBest = [];
    for (var pos in results) {
        for (var i in results[pos]) {
            if (results[pos][i].adp > adp) {
                nextBest[pos] = results[pos][i];
                break;
            }
        }
        var delta = 0;
        var string = 'n/a';
        if (nextBest[pos]) {
            delta = (results[pos][0].total - nextBest[pos].total);
            string = results[pos][0].name
                + ' ('
                + results[pos][0].adp
                + ') vs '
                + nextBest[pos].name
                + ' ('
                + nextBest[pos].adp
                + ')';
        }

        result.push(new ResultEntry(pos, delta, string));
    }

    result.sort(function(a, b) {
        return b.delta - a.delta;
    });
    return result;
};

var allPlayers = function allPlayers() {
    var all = [];
    for (var pos in results) {
        for (var i in results[pos]) {
            if (all.indexOf(results[pos][i]) == -1) {
                all.push(results[pos][i]);
            }
        }
    }
    all.sort(adpSort);
    return all;
};

var draft = function draft(name) {
    function removePlayer(players) {
        for (var i in players) {
            if (players[i] && players[i].name === name) {
                players.splice(i, 1);
            }
        }
    };

    for (var pos in results) {
        removePlayer(results[pos]);
    }
    removePlayer(adpSorted);
};

var allByPosition = function allByPosition(position) {
    return results[position];
};

module.exports.bestAvailable = bestAvailable;
module.exports.allPlayers = allPlayers;
module.exports.draft = draft;
module.exports.allByPosition = allByPosition;
