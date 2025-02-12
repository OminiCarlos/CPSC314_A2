/**
 * @author jaliborc / http://jaliborc.com/ with a modification for CPSC314 use
 */
import * as THREE from './three.module.js';

class SourceLoader {
	constructor(manager) {
		this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
	};

	load(urls, onLoad) {
		this.urls = urls
		this.results = {}
		this.loadFile(0)
		this.onLoad = onLoad
	}

	loadFile(i) {
		if (i == this.urls.length)
    		return this.onLoad(this.results)

    	var scope = this
    	var url = this.urls[i]
		var loader = new THREE.FileLoader(this.manager);
		loader.load(url, function(text) {
			scope.results[url] = text
	    	scope.loadFile(i+1)
	  	})
	}
}

export {SourceLoader};
