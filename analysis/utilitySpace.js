
var fs = require('fs');
var nl = require('os').EOL;

module.exports = UtilitySpace;

function UtilitySpace(issues) {
  this.issues = issues.issueByIndex;
  this.weightmultiplyer = issues.weightmultiplyer;
  this.reservation = issues.reservation;
  this.optout = issues.optout;
  this.timeeffect = issues.timeeffect? issues.timeeffect: 0;
  this.AvrageValuesPerIssue;
}

UtilitySpace.prototype = {

  getUtility: function(bid){
    var utility = 0;
    var issueNum = 0;
    for (is in this.issues) if (this.issues.hasOwnProperty(is)) issueNum++; // ??? sepposed to count the num of the issues in the bid i sent
    //for (b in bid) if (this.issues.hasOwnProperty(b)) issueNum++;
    for (var i=0; i< issueNum; i++){
      var issue = this.issues[i+1];
      if ((issue.index -1) != i){
        i = issue.Index;
        return 0;
      }
      var valueInBid = bid[issue.name]
      if (valueInBid){
        var Index = 1;
        for(item in issue.values) {
            if(issue.values[item] == valueInBid)
                break;
            Index++;
        }
        if (issue.itemByIndex[Index])
          var valueInEvaluator = issue.itemByIndex[Index].evaluation;
        else
          var valueInEvaluator = 1;
      }
      else{
        var valueInEvaluator = this.AvrageValuesPerIssue[(issue.name).toLowerCase()];
      }
      utility += (issue.weight * valueInEvaluator * this.weightmultiplyer)
    }
    return utility;
  },

   getPartialUtility: function(bid){
    var utility = 0;
    var issueNum = 0;
    for (is in this.issues) if (this.issues.hasOwnProperty(is)) issueNum++; // ??? sepposed to count the num of the issues in the bid i sent
    //for (b in bid) if (this.issues.hasOwnProperty(b)) issueNum++;
    for (var i=0; i< issueNum; i++){
      var issue = this.issues[i+1];
      if ((issue.index -1) != i){
        i = issue.Index;
        return 0;
      }
      var valueInBid = bid[issue.name]
      if (valueInBid){
        var Index = 1;
        for(item in issue.values) {
            if(issue.values[item] == valueInBid)
                break;
            Index++;
        }
        if (issue.itemByIndex[Index])
          var valueInEvaluator = issue.itemByIndex[Index].evaluation;
        else
          var valueInEvaluator = 1;

        utility += (issue.weight * valueInEvaluator * this.weightmultiplyer)
      }
    }
    return utility;
  },

 /* getUtilityWithoutDiscount: function(bid){
    var utility = 0;
    for (var iIssue in this.issues) {
       var issue = this.issues[iIssue];
       var valueInBid = bid[issue.name];
       for (iValue in issue.itemByIndex) {
           var value = issue.itemByIndex[iValue];
           if (valueInBid===value.value)
              utility += (value.evaluation * issue.weight * this.weightmultiplyer);
       }
    }
    return utility;
  },*/
  getUtilityWithDiscount : function(utility, roundsFromStart) {
    if (roundsFromStart)
      return utility + roundsFromStart * this.timeeffect;
    else
     return utility + 1 * this.timeeffect; 
  },

  enterEsperationScale: function(){
    var A = []
    var issueNum = 0;
    for (is in this.issues) if (this.issues.hasOwnProperty(is)) issueNum++;
    for (var i = 1; i<= issueNum; i++){
      A.push(this.issues[i].name);
    }
    console.log(A);
    return A;
  },

  readAspirationFile: function(){
  var some = new Object();
  var f = true;
  var j;
  var lines = fs.readFileSync('./domains/JobCandiate/aspiration.xml', 'utf8');
  //var lines = fs.readFileSync('./domains/israel/Kitchen/aspiration.xml', 'utf8');
  lines = lines.split(nl);
  return (lines);
},


   
}
