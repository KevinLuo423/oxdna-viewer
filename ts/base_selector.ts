let listBases: number[] = []; //list of bases to download in .txt file
let basesInfo: string = ""; //list of bases' info - location, strand and system ids, etc. - to download in .txt file
let mouse3D;
let raycaster = new THREE.Raycaster();;
let intersects;
			

document.addEventListener('mousedown', event => { //if mouse is pressed down
	if (getActionModes().includes("Select")) {
		let id = gpu_picker(event)

		//if something was clicked, toggle the coloration of the appropriate things.
		if (id > -1) {
			// This runs after the selection is done and the nucleotides are toggled,
			// but it needs to be defined as a callback since the cluster selection
			// can take a while to finish.

			let nucleotide = elements[id];
			let sys = nucleotide.parent.parent;

			// Select multiple elements my holding down ctrl
			if (!event.ctrlKey && !selected_bases.has(nucleotide)) {
				clearSelection();
			}
			
			let strand_count = sys[strands].length;
			switch(getScopeMode()){
				case "System" :
					for (let i = 0; i < strand_count; i++){  //for every strand in the System
						let strand = sys[strands][i];
						let nuc_count = strand[monomers].length;
                        for (let j = 0; j < nuc_count; j++) // for every nucleotide on the Strand
                            strand[monomers][j].toggle();
					}
					updateView(sys);
					break;
				case "Strand" :
					let strand_length = nucleotide.parent[monomers].length;
					for (let i = 0; i < strand_length; i++)  //for every nucleotide in strand
						nucleotide.parent[monomers][i].toggle();
					updateView(sys);
					break;
				case "Monomer":
					nucleotide.toggle();
					updateView(sys);
					break;
				case "Cluster" :
					// Calculate clusters (if not already calculated) and toggle
					// nucletides within callback to make sure that clustering
					// is complete.
					calculateClusters(function() {
						//for every strand in the System
						for (let i = 0; i < strand_count; i++){
							let strand = sys[strands][i];
							let nuc_count = strand[monomers].length;
							// for every nucleotide on the Strand in the System
							for (let j = 0; j < nuc_count; j++) {
								let n: BasicElement = strand[monomers][j];
								if(n.cluster_id == nucleotide.cluster_id) {
									n.toggle();
								}
							}
						}
						updateView(sys);
					});
					break;

			}
		}
	}
});

function updateView(sys) {
	//tell the GPU to update the colors in the scene
	sys.backbone.geometry["attributes"].instanceColor.needsUpdate = true;
	sys.nucleoside.geometry["attributes"].instanceColor.needsUpdate = true;
	sys.connector.geometry["attributes"].instanceColor.needsUpdate = true;
	sys.bbconnector.geometry["attributes"].instanceColor.needsUpdate = true;

	render(); //update scene;

	listBases = [];
	let baseInfoStrands = {};

	//sort selection info into respective containers
	selected_bases.forEach(
		(base) => {
			//store global ids for BaseList view
			listBases.push(base.global_id);

			//assign each of the selected bases to a strand
			let strand_id = base.parent.strand_id;
			if(strand_id in baseInfoStrands)
				baseInfoStrands[strand_id].push(base);
			else
				baseInfoStrands[strand_id] = [base];
		}
	);

	//Display every selected nucleotide id (top txt box)
	makeTextArea(listBases.join(","), "BaseList");

	//Brake down info (low txt box)
	let baseInfoLines = [];
	for (let strand_id in baseInfoStrands){
		let s_bases = baseInfoStrands[strand_id];
		//make a fancy header for each strand
		let header = ["Str#:", strand_id, "Sys#:", s_bases[0].parent.parent.system_id];
		baseInfoLines.push("----------------------");
		baseInfoLines.push(header.join(" "));
		baseInfoLines.push("----------------------");

		//fish out all the required base info
		//one could also sort it if neaded ...
		for(let i = 0; i < s_bases.length; i++){
			baseInfoLines.push(["sid:", s_bases[i].global_id, "|", "lID:", s_bases[i].local_id].join(" "));
		}
	}
	makeTextArea(baseInfoLines.join("\n"), "BaseInfo"); //insert basesInfo into "BaseInfo" text area
};

function clearSelection() {
	elements.forEach(element => {
		if (selected_bases.has(element)) {
			element.toggle();
		}
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function invertSelection() {
	elements.forEach(element => {
			element.toggle();
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function selectAll() {
	elements.forEach(element => {
		if (!selected_bases.has(element)) {
			element.toggle();
		}
	});
	systems.forEach(sys => {
		updateView(sys);
	});
}

function makeTextArea(bases: string, id) { //insert "bases" string into text area with ID, id
	let textArea: HTMLElement | null = document.getElementById(id);
	if (textArea !== null) { //as long as text area was retrieved by its ID, id
		textArea.innerHTML =  bases; //set innerHTML / content to bases
	}
}

function writeMutTrapText(base1: number, base2: number): string { //create string to be inserted into mutual trap file
	return "{\n" + "type = mutual_trap\n" +
		"particle = " + base1 + "\n" +
		"ref_particle = " + base2 + "\n" +
		"stiff = 0.09\n" +
		"r0 = 1.2 \n" + 
		"PBC = 1" + "\n}\n\n";
}

function makeMutualTrapFile() { //make download of mutual trap file from selected bases
    let mutTrapText: string = "";
    for (let x = 0; x < listBases.length; x = x + 2) { //for every selected nucleotide in listBases string
        if (listBases[x+1] !== undefined) { //if there is another nucleotide in the pair
            mutTrapText = mutTrapText + writeMutTrapText(listBases[x], listBases[x + 1]) + writeMutTrapText(listBases[x + 1], listBases[x]); //create mutual trap data for the 2 nucleotides in a pair - selected simultaneously
		}
		else { //if there is no 2nd nucleotide in the pair
			alert("The last selected base does not have a pair and thus cannot be included in the Mutual Trap File."); //give error message
		}
	}
	makeTextFile("mutTrapFile", mutTrapText); //after addding all mutual trap data, make mutual trap file
}

function makeSelectedBasesFile() { //make selected base file by addign listBases to text area
    makeTextFile("baseListFile", listBases.join(", "));
}

let textFile: string;
function makeTextFile(filename: string, text: string) { //take the supplied text and download it as filename
	let blob = new Blob([text], {type:'text'});
	var elem = window.document.createElement('a');
                elem.href = window.URL.createObjectURL(blob);
                elem.download = filename;
                document.body.appendChild(elem);
                elem.click();
                document.body.removeChild(elem);
};

function openTab(evt, tabName) { //open clicked tab - Idk how this works
	let i: number;
	let tabcontent;
	let tablinks;
	tabcontent = document.getElementsByClassName("tabcontent");
	for (i = 0; i < tabcontent.length; i++) {
		tabcontent[i].style.display = "none";
	}
	tablinks = document.getElementsByClassName("tablinks");
	for (i = 0; i < tablinks.length; i++) {
		tablinks[i].className = tablinks[i].className.replace(" active", "");
	}
	let tab: HTMLElement | null = document.getElementById(tabName);
	if (tab !== null) {
		tab.style.display = "block";
	}
	evt.currentTarget.className += " active";
}

/**
 * Modified from SelectionBox code by HypnosNova
 * https://github.com/mrdoob/three.js/blob/master/examples/jsm/interactive
 * 
 * Used for box selection functionality in DragControls
 */
class BoxSelector {
    private frustum = new THREE.Frustum();
	private startPoint = new THREE.Vector3();
	private endPoint = new THREE.Vector3();
	private collection = [];
	private camera: THREE.PerspectiveCamera;
	private deep: number;
	private drawnBox: HTMLElement;

	/**
	 * @param startPoint Start position x,y,z
	 * @param camera Camera, to calculate frustum
	 * @param deep Optional depth of frustum
	 */
    constructor(startPoint: THREE.Vector3, camera: THREE.PerspectiveCamera, deep?: number) {
		this.camera = camera;
		this.deep = deep || Number.MAX_VALUE;

		let pos = this.toScreenSpace(startPoint);

		this.drawnBox = document.createElement('div');
		this.drawnBox.classList.add('selectBox');
		this.drawnBox.style.pointerEvents = 'none';
		this.drawnBox.style.left = pos.x + 'px';
		this.drawnBox.style.top = pos.y + 'px';
		this.drawnBox.style.width = '0px';
		this.drawnBox.style.height = '0px';

		renderer.domElement.parentElement.appendChild(this.drawnBox);

		console.log("We're inside the constructor");

		this.startPoint = startPoint.clone(); //event.clientX; //event.clientY;
	};

	/**
	 * @param endPoint (optional) End position x,y,z
	 * @param startPoint (optional) Start position x,y,z
	 * @return Selected elements
	 */
    public select(endPoint?: THREE.Vector3, startPoint?: THREE.Vector3): BasicElement[] {
		this.startPoint = startPoint || this.startPoint;
		this.endPoint = endPoint || this.endPoint;

		// Update drawn box
		let screenStart = this.toScreenSpace(this.startPoint);
		let screenEnd = this.toScreenSpace(this.endPoint);

		let pointBottomRight = new THREE.Vector2(
			Math.max(screenStart.x, screenEnd.x),
			Math.max(screenStart.y, screenEnd.y)
		);
		let pointTopLeft = new THREE.Vector2(
			Math.min(screenStart.x, screenEnd.x),
			Math.min(screenStart.y, screenEnd.y)
		);
		this.drawnBox.style.left = pointTopLeft.x + 'px';
		this.drawnBox.style.top =  pointTopLeft.y + 'px';
		this.drawnBox.style.width = pointBottomRight.x - pointTopLeft.x + 'px';
		this.drawnBox.style.height = pointBottomRight.y - pointTopLeft.y + 'px';

		// Update selected elements within box
		this.collection = [];

		this.updateFrustum(this.startPoint, this.endPoint);

		elements.forEach(element => {
			let cm_pos = element.get_instance_parameter3("cm_offsets");
			if (this.frustum.containsPoint(cm_pos)) {
				this.collection.push(element);
			}
		});

		return this.collection;
	};

	public onSelectOver() {
		this.drawnBox.parentElement.removeChild(this.drawnBox);
	};

	private toScreenSpace(pos: THREE.Vector3): THREE.Vector2 {
		var rect = renderer.domElement.getBoundingClientRect();
		return new THREE.Vector2(
			rect.left + (rect.width *  pos.x + rect.width)/2,
			rect.top + (rect.height * -pos.y + rect.height)/2
		);
	}

	private updateFrustum(startPoint?: THREE.Vector3, endPoint?: THREE.Vector3) {
		startPoint = startPoint || this.startPoint;
		endPoint = endPoint || this.endPoint;

		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld(false);

		let tmpPoint = startPoint.clone();
		tmpPoint.x = Math.min(startPoint.x, endPoint.x);
		tmpPoint.y = Math.max(startPoint.y, endPoint.y);
		endPoint.x = Math.max(startPoint.x, endPoint.x);
		endPoint.y = Math.min(startPoint.y, endPoint.y);

		let vecNear = this.camera.position.clone();
		let vecTopLeft = tmpPoint.clone();
		let vecTopRight = new THREE.Vector3(endPoint.x, tmpPoint.y, 0);
		let vecDownRight = endPoint.clone();
		let vecDownLeft = new THREE.Vector3(tmpPoint.x, endPoint.y, 0);

		vecTopLeft.unproject(this.camera); vecTopRight.unproject(this.camera);
		vecDownLeft.unproject(this.camera); vecDownRight.unproject(this.camera);

		let vectemp1 = vecTopLeft.clone().sub(vecNear);
		let vectemp2 = vecTopRight.clone().sub(vecNear);
		let vectemp3 = vecDownRight.clone().sub(vecNear);

		vectemp1.normalize(); vectemp2.normalize(); vectemp3.normalize();

		vectemp1.multiplyScalar(this.deep);
		vectemp2.multiplyScalar(this.deep);
		vectemp3.multiplyScalar(this.deep);

		vectemp1.add(vecNear); vectemp2.add(vecNear); vectemp3.add(vecNear);

		var planes = this.frustum.planes;

		planes[0].setFromCoplanarPoints(vecNear, vecTopLeft, vecTopRight);
		planes[1].setFromCoplanarPoints(vecNear, vecTopRight, vecDownRight);
		planes[2].setFromCoplanarPoints(vecDownRight, vecDownLeft, vecNear);
		planes[3].setFromCoplanarPoints(vecDownLeft, vecTopLeft, vecNear);
		planes[4].setFromCoplanarPoints(vecTopRight, vecDownRight, vecDownLeft);
		planes[5].setFromCoplanarPoints(vectemp3, vectemp2, vectemp1);
		planes[5].normal.multiplyScalar(-1);
	};
};