module.exports = OpponentData;

 var fs = require('fs');
 var nl = require('os').EOL;


function OpponentData(side, type, nik,country){ 
	this.oppType = type;
	this.country = country;
	this.nikName = nik; //the short name of the type opp.
	this.oppUtility = 0;
	this.lastOfferIndex = 0;
	this.oppSide = side;
	this.agentOffers = [];
	this.allOfferUtilitySum = 0;
	this.AvrageValuesPerIssue;
	this.probability = 0; //current probability of the type
	this.calcProbability; // probability for calculation 
	this.agentAcceptThersholds = new Array();
	this.storedAllArgument = new Array();
	this.initializeOpponentData();
}

OpponentData.prototype = {

	initializeOpponentData: function(){
		var tasks = readCFGfile(this.oppSide, this.oppType,this.country);
		this.agentAcceptThersholds = tasks.AgentThersholds;
		this.agentOffers = tasks.AgentOffers;
		this.AvrageValuesPerIssue = tasks.AvrageValuesPerIssue;
    },

    calculateCurrOpp: function(utility){
    	var self = this;
    	self.calcProbability = utility * self.probability; //the numerator of the calculation of the probabilit
    	return this.calcProbability;
    }
}
  
function readCFGfile(side, type, country){

	var some = new Object();
	var f = true;
	var j;
	console.log(side+type)
	var lines = fs.readFileSync('./domains/'+country+'/JobCandiate/AgentConfig' + side + type +'.cfg', 'utf8');//, function (err,data){
	// var lines = fs.readFileSync('./domains/'+country+'/Kitchen/AgentConfig' + side + type +'.cfg', 'utf8');//, function (err,data){
			
	    lines = lines.split(nl);
		for(line in lines){
		    // 'line' contains the current line without the trailing newline character.
			switch (line){
				case '0': {some['numOfTurns'] = lines[line]; break;}
				case '1': {some['AgentThersholds'] = {}; j=1; break;}
				case '17': {some['AgentOffers'] = {}; j=1; break;}
				case '16': {break;}
				case '32' :{some['AvrageValuesPerIssue'] = {}; break;}
				case '33' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				case '34' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				case '35' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				case '36' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				case '37' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				case '38' :{some['AvrageValuesPerIssue'][lines[line].split("*")[0]] = lines[line].split("*")[1]; break;}
				default:{if (line>1 && line<16)
							some['AgentThersholds'][j++] = lines[line]; 
						 if (line>17 && line<32){
						 	var temp = {};
						 	for (var a= 1; a<lines[line].split("*").length; (a= a+2)){
					 			temp[lines[line].split("*")[a]] = lines[line].split("*")[a -1];
						 	}
							some['AgentOffers'][j++] =  temp;
						}
						break;
					}
			}
		}
	//});
		return (some);
}

