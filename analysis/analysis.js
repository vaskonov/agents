module.exports = Analysis;

function Analysis(item){ //the item is the variable with the information on the domain(all the issues)
	this.issues = item;
	this.init = true;
	this.numberOfIssues = item.length;
	this.valuesIndexes= new Array(this.numberOfIssues);
	for(var i=0;i<this.numberOfIssues ;i++) {
			this.valuesIndexes[i]=0;			
	}
}

Analysis.prototype = {

	hasNext: function(){
		var nextIndex = this.makeNextIndex();
		var result = false;
		if(this.init){
			return true;
		}else{
			for (var i=0; i<this.numberOfIssues; i++){
				if(nextIndex[i] != 0){
					result = true;
					break;
				}
			}
			return result;
		}
	},

	makeNextIndex: function (){
		var newIndex = new Array(this.numberOfIssues);
		for (var i =0; i<this.numberOfIssues; i++){
			newIndex[i] = this.valuesIndexes[i];
		}
		for (var i =0; i<this.numberOfIssues; i++){
			var issue = this.issues[i];
			var numberOfValues = this.issues[i].value.length;
			if(newIndex[i] < numberOfValues-1){
				newIndex[i]++;
				break;
			} else{
				newIndex[i] = 0;
			}
		}
		return newIndex;
	},

	next: function (){
		var bid = new Object();
		var nextIndex = this.makeNextIndex();
		if(this.init){
			this.init = false;
		}else{
			this.valuesIndexes = nextIndex;
		}
		for (var i = 0; i<this.numberOfIssues; i++){
			var issue = this.issues[i];
			bid[issue.name] = issue.value[this.valuesIndexes[i]];
		}
		return bid;
	}
}