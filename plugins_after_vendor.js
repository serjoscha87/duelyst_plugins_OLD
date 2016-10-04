/*
* this code enables plugin devs to expose hidden data from internal "classes" they need for their addons
*/
window.custom_plugins = {
	// "config"
	toExpose : { // hidden ClassManager instances to be exposed by this script
		// table Id once generated with genTableId				// the key to access the exposed data later within runtime
		// ===========================================|||==========================================================================
		'TTdhSFPDv8OMf0Rtw4TCsMOyEnPCkg==' 					: 'battlelog' // 1096@duelyst.js => battlelog behavior and logic			|| note: cc.Class.prototype.getScene().getGameLayer()._battleLog
		//,'IsKWw7w/XMO8QMO2wodLwrRIEGDDvsOu'					: 'battlemap' // 1097 
		,'wpMQwrNhWHpFa2jDtsKkwpzCjMKXD8O2'					: 'FXCompositeLayer' // 1099@duelyst.js => much control over view elements that is needed when wanting to hook into match start ui actions
	},
	
	// don't bother about these
	util:{},
	exposed:{},
	exposedInsts:{}
};

cc.Class.orig_ccClassExtend = cc.Class.extend; // save original vendor func
cc.Class.extend = function(t) { // now overwrite it with own stuff (hook)
	var hiddenCMinstance = cc.Class.orig_ccClassExtend.call(this, t); // call the original extend to fetch the later hidden object
	var tableHash = window.custom_plugins.util.genTableId(t); // table data identification string...
		//if(t._ui_z_order_high_priority_support_nodes) console.info(hiddenCMinstance); //console.info(tableHash); // for dev: get the hash of a desired table printed to the console NOTE NOTE NOTE NOTE NOTE NOTE NOTE DONT TAKE FIELDS THAT ARE NULL!!!
	if(window.custom_plugins.toExpose[tableHash]) { // so if we want this internal data to be exposed...
		var orig_ctor = hiddenCMinstance.prototype.ctor; // save original constructor of this internal data
		hiddenCMinstance.prototype.ctor = function(){  // hook our custom code into the internal data constructor
			window.custom_plugins.exposed[window.custom_plugins.toExpose[tableHash]] = this; // expose what we jacked
			orig_ctor.apply(this,arguments); // call the original constructor
		}
		window.custom_plugins.exposedInsts[window.custom_plugins.toExpose[tableHash]] = hiddenCMinstance;
	}
		
	return hiddenCMinstance; // return what the call to the original constructor gave us (just hand it over to the next caller)
};

window.custom_plugins.util = {
	genTableId: function(tableObject){ // remind that this may slow down initial game loading a lot  (because of md5 hashing every game structure data).. perhaps. This could really super easily be quickened up but would be pretty uncool for md5 got a micro colision chance and shortens the table identification string massively
		return AWS.util.base64.encode(AWS.util.crypto.md5(JSON.stringify(Object.keys(tableObject))));
	}
};