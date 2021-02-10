// Use Metro GUI
declare var Metro: any;

function drawSystemHierarchy() {
    let checkboxhtml = (label)=> `<input data-role="checkbox" data-caption="${label}">`;

    const includeMonomers = (document.getElementById("hierarchyMonomers") as HTMLInputElement).checked;

    const content: HTMLElement = document.getElementById("hierarchyContent");
    content.innerText = '';

     let hierarchy = Metro.makePlugin(content, "treeview", {
        onCheckClick: (state, check, node, tree) => {
            let n = $(node);
            let element: BasicElement = n.data('monomer');
            if (element) {
                if (check.checked) {element.select()}
                else {element.deselect()}
                updateView(element.getSystem());
                return;
            }
            let strand: Strand = n.data('strand');
            if (strand) {
                if (check.checked) {strand.select()}
                else {strand.deselect()}
                updateView(strand.system);
                return;
            }
            let system = n.data('system');
            if (system) {
                if (check.checked) {system.select()}
                else {system.deselect()}
                updateView(system);
                return;
            }
        },
        showChildCount: true
    });
    let treeview = hierarchy.data('treeview');

    let checkboxMap: Map<number, HTMLInputElement> = new Map();

    // Add checkbox nodes for, systems, strands and monomers
    for(const system of systems) {
        let systemNode = treeview.addTo(null, {
            html: checkboxhtml(system.label ? system.label : `System ${system.id}`)
        });
        systemNode.data('system', system);
        for(const strand of system.strands) {
            let monomers = strand.getMonomers();
            let strandNode = treeview.addTo(systemNode, {
                html: checkboxhtml(
                    strand.label ? strand.label : `Strand ${strand.id}` +
                    ` (${monomers.length}${strand.isCircular() ? ' circular':''})`
                )
            });
            strandNode.data('strand', strand);
            if (includeMonomers) {
                let addMonomer = (monomer) => {
                    let color = monomer.elemToColor(monomer.type).getHexString();
                    let monomerNode = treeview.addTo(strandNode, {
                        html: checkboxhtml(`id: ${monomer.id}`.concat(
                            monomer.label ? ` (${monomer.label})` : "")) +
                            `<span style="background:#${color}4f; padding: 5px">${monomer.type}</span>`
                    });
                    monomerNode.data('monomer', monomer);
    
                    // Save reference for checbox in map:
                    let checkbox = monomerNode.find("input")[0];
                    checkbox.checked = selectedBases.has(monomer);
                    checkboxMap.set(monomer.id, checkbox);
                }
                for(const [i, monomer] of monomers.entries()) {
                    if (i<20) {
                        addMonomer(monomer);
                    } else {
                        let moreNode = treeview.addTo(strandNode, {
                            caption: `View remaining ${monomers.length-i} monomers`,
                            icon: '<span class="mif-plus"></span>'
                        });
                        moreNode[0].onclick = ()=>{
                            treeview.del(moreNode);
                            for(let j=i; j<monomers.length; j++) {
                                addMonomer(monomers[j]);
                            }
                        }

                        break;
                    }
                }
            }
        }
    }
    //});});});

    treeview._recheck(hierarchy);

    hierarchy.data('checkboxMap', checkboxMap);
    /*
    // Add listeners for if an element is toggled
    document.addEventListener('elementSelectionEvent', event=>{
        checkboxMap.get(event['element'].id).checked = event['selected'];
        //treeview._recheck(tv);
    });
    */
}

function handleMenuAction(event: String) {
    switch (event) {
        case "undo": editHistory.undo(); break;
        case "redo": editHistory.redo(); break;
        case "del": deleteWrapper(); break;
        case "cut": cutWrapper(); break;
        case "copy": copyWrapper(); break;
        case "paste": pasteWrapper(false); break;
        case "all": selectAll(); break;
        case "invert": invertSelection(); break;
        case "clear": clearSelection(); break;
    }
}

function updateColorPalette() {
    const opt: HTMLElement = document.getElementById("colorPaletteContent");
    if (!opt.hidden) {
        opt.innerHTML = "";  //Clear content

        //modifies the backboneColors array
        for (let i = 0; i < backboneColors.length; i++) {
            let m = backboneColors[i];
            let c = document.createElement('input');
            c.type = 'color';
            c.value = "#" + m.getHexString();
            c.onchange = function () {
                backboneColors[i] = new THREE.Color(c.value);
                updateColorPalette();
            }
            
            //deletes color on right click
            c.oncontextmenu = function (event) {
                event.preventDefault();
                backboneColors.splice(i, 1);
                updateColorPalette();
                return false;
            }
            opt.appendChild(c);
        }

        //actually update things in the scene
        elements.forEach(e=>{
            if (!selectedBases.has(e)) {
                e.updateColor();
            }
        });
        systems.forEach(s=> {
            s.callUpdates(['instanceColor'])
        });

        tmpSystems.forEach(s => {
            s.callUpdates(['instanceColor'])
        });

        render();
    }
};

function initLutCols(systems: System[]) {
    for (let i = 0; i < systems.length; i++) {
        const system = systems[i];
        for (let j = 0; j < system.bbColors.length; j += 3) {
            const r = system.bbColors[j];
            const g = system.bbColors[j + 1];
            const b = system.bbColors[j + 2];
            
            system.lutCols[j/3] = new THREE.Color(r,g,b);
        }
    }
}

function resetCustomColoring() {
    view.coloringMode.set("Strand");
    initLutCols(systems);
    initLutCols(tmpSystems);
    clearSelection();
}

// create color map with selected color
function colorElements(color?: THREE.Color, elems?: BasicElement[]) {
    if (!color) {
        let colorInput = (document.getElementById("customColor") as HTMLInputElement);
        color = new THREE.Color(colorInput.value);
    }
    if (!elems) {
        elems = Array.from(selectedBases);
    }

    if(elems.length == 0) {
        notify("Please first select the elements you wish to color");
    }

    elems.forEach(e=>{
        e.color = color;
    });

    view.coloringMode.set("Custom");

    clearSelection();
}

//toggles display of coloring by json file / structure modeled off of base selector
function updateColoring(mode?: string) {
    if(!mode) {
        mode = view.coloringMode.get()
    } else {
        view.coloringMode.set(mode);
    }
    if (mode === "Overlay") {
        if (lut) {
            if (colorbarScene.children.length == 0 && systems.some(system => system.colormapFile)) {
                api.showColorbar();
            }
        } else {
            notify("Please drag and drop the corresponding .json file.");
            view.coloringMode.set("Strand");
            return;
        }
    } else if (lut) {
        api.removeColorbar();
    }

    elements.forEach(e => e.updateColor());
    systems.forEach(s => s.callUpdates(['instanceColor']));

    if (tmpSystems.length > 0) {
        tmpSystems.forEach(s => s.callUpdates(['instanceColor']));
    }
    render();
}

function toggleVisArbitrary() {
    // arbitrary visibility toggling
    // toggle hidden monomers
    if (selectedBases.size == 0) {
        systems.forEach(system=>{
            system.strands.forEach(strand=>{
                strand.forEach(monomer=>{
                    if(monomer.getInstanceParameter3("visibility").x == 0)
                        monomer.toggleVisibility();
                });
            });
        });
    }
    // toggle selected monomers
    else {
        selectedBases.forEach(e => e.toggleVisibility());
    }
    
    systems.forEach(sys => sys.callUpdates(['instanceVisibility']));
    tmpSystems.forEach(tempSys => tempSys.callUpdates(['instanceVisibility']));
    clearSelection();
}

function notify(message: string, type?: string, title?: string) {
    let n = Metro.notify;
    if(!type) {
        type = "info";
    }
    n.create(message, title, {
        cls: type,
        timeout: 5000
    });
    console.info(`Notification: ${message}`);
}

function setBackgroundImage() {
    let file = (document.getElementById("backgroundInput") as HTMLInputElement).files[0];
    let reader = new FileReader();
    reader.onloadend = function() {
        document.getElementById('threeCanvas').style.backgroundImage = "url(" + reader.result + ")";
    }
    if (file) {
        reader.readAsDataURL(file);
    }
}

function setBackgroundColor() {
    let color = (document.getElementById("backgroundColor") as HTMLInputElement).value;
    document.getElementById('threeCanvas').style.background = color;
}

class ToggleGroup {
    private id: string;
    private doc: Document;
    private onChange: (toggleGroup: ToggleGroup)=>void;

    constructor(id: string, doc: Document, onChange?:(toggleGroup: ToggleGroup)=>void) {
        this.id = id;
        this.doc = doc;
        this.onChange = onChange;
    }

    public set(value: string) {
        let toggleGroup = this.doc.getElementById(this.id);
        let active = toggleGroup.querySelector('.active');
        if (active) {
            active.classList.remove('active');
        }
        for (let opt of toggleGroup.children) {
            if (opt.querySelector('.caption').innerHTML == value) {
                opt.classList.add('active');
                break;
            }
        }
        if (this.onChange) {
            this.onChange(this);
        }
    }

    public get() {
        return this.doc.getElementById(this.id).querySelector('.active').querySelector('.caption').innerHTML;
    }
}

class ToggleGroupWithDisable extends ToggleGroup {
    private lastActive: string;
    private disabled: string;

    constructor(id: string, doc: Document, lastActive: string, disabled: string, onChange?: (toggleGroup: ToggleGroupWithDisable)=>void) {
        super(id, doc, onChange);
        this.lastActive = lastActive;
        this.disabled = disabled;
    }

    public toggle() {
        this.enabled() ? this.disable() : this.enable();
    }

    public disable() {
        if (this.enabled()) {
            this.lastActive = this.get();
            this.set(this.disabled);
        }
    };

    public enable() {
        if (!this.enabled()) {
            this.set(this.lastActive)
        }
    };

    public enabled(): boolean {
        return this.get() !== this.disabled;
    }
}

class View {
    private doc: Document;

    coloringMode: ToggleGroup;
    centeringMode: ToggleGroupWithDisable;
    inboxingMode: ToggleGroupWithDisable;
    selectionMode: ToggleGroupWithDisable;
    transformMode: ToggleGroupWithDisable;

    basepairMessage = "Locating basepairs, please be patient...";


    constructor(doc: Document) {
        this.doc = doc;

        // Initialise toggle groups
        this.coloringMode = new ToggleGroup('coloringMode', doc, ()=>{updateColoring()});
        this.centeringMode = new ToggleGroupWithDisable('centering', doc, 'Origin', 'None');
        this.inboxingMode = new ToggleGroupWithDisable('inboxing', doc, 'Monomer', 'None');
        this.selectionMode = new ToggleGroupWithDisable('selectionScope', doc, 'Monomer', 'Disabled');
        this.transformMode = new ToggleGroupWithDisable('transform', doc, 'Translate', 'None', (g: ToggleGroupWithDisable)=>{
            // If we should show something
            if (g.enabled()) {
                // Make sure something is selected
                if (selectedBases.size > 0) {
                    transformControls.show();
                    transformControls.setMode(g.get().toLowerCase());
                } else {
                    notify("Please select elements to transform");
                    g.disable();
                }
            } else {
                transformControls.hide()
            }
        });
    }

    public sectionClicked() {
        let s = document.getElementsByClassName("section active")[0] as HTMLElement;
        s.hidden = !s.hidden;
    }

    public getRandomHue(): THREE.Color {
        return new THREE.Color(`hsl(${Math.random()*360}, 100%, 50%)`);
    }

    public getInputNumber(id: string): number {
        return parseFloat(this.getInputValue(id));
    }

    public getInputValue(id: string): string {
        return (<HTMLInputElement>this.doc.getElementById(id)).value;
    }

    public getInputBool(id: string): boolean {
        return (<HTMLInputElement>document.getElementById(id)).checked;
    }

    public isWindowOpen(id: string): boolean {
        let elem = this.doc.getElementById(id);
        if (elem) {
            // Should work but doesn't
            //return Metro.window.isOpen(elem);
            return elem.parentElement.parentElement.style.display != "none";
        } else {
            return false;
        }
        
    }

    public toggleWindow(id: string, oncreate?: ()=>void) {
        let elem = this.doc.getElementById(id);
        if (elem) {
            Metro.window.toggle(elem);
        } else {
            this.createWindow(id, oncreate);
        }
    }

    public createWindow(id: string, oncreate?: ()=>void) {
        fetch(`windows/${id}.json`)
            .then(response => response.json())
            .then(data => {
                let w = Metro.window.create(data);
                w[0].id = id;
                w.load(`windows/${id}.html`).then(oncreate);
            }
        );
    }

    public showHoverInfo(pos: THREE.Vector2, e: BasicElement) {
        let hoverInfo = document.getElementById('hoverInfo');
        let color = e.elemToColor(e.type).getHexString();
        hoverInfo.innerHTML = `<span style="background:#${color}4f; padding: 5px">${e.type} ${e.getSystem().id}:${e.strand.id}:${e.id}</span>`;
        hoverInfo.style.left = pos.x  + 'px';
        hoverInfo.style.top =  pos.y + 20 + 'px';
        hoverInfo.hidden = false;
    }
    public hideHoverInfo() {
        document.getElementById('hoverInfo').hidden = true;
    }

    public selectPairs(): boolean {
        return (<HTMLInputElement>this.doc.getElementById("selectPairs")).checked;
    }

    public saveCanvasImage(){
        canvas.toBlob(function(blob){
            var a = document.createElement('a');
            var url = URL.createObjectURL(blob);
            a.href = url;
            a.download = 'canvas.png';
            a.click();
        }, 'image/png', 1.0);
        //get the colorbar too
        if (colorbarScene.children.length != 0) {
            renderColorbar();
            colorbarCanvas.toBlob(function(blob) {
                var a = document.createElement('a');
                var url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'colorbar.png';
                a.click();
            }, 'image/png', 1.0);
        }
    }

    public longCalculation(calc: () => void, message: string, callback?: () => void) {
        let activity = Metro.activity.open({
            type: 'square',
            overlayColor: '#fff',
            overlayAlpha: 1,
            text: message
        });

        // Set wait cursor and request an animation frame to make sure
    // that it gets changed before starting calculation:
    let dom = document.activeElement;
    dom['style'].cursor = "wait";
    requestAnimationFrame(() => requestAnimationFrame(() => {
        try {
           calc(); 
        } catch (error) {
           notify(`Sorry, something went wrong with the calculation: ${error}`, "alert");
        }

        // Change cursor back and remove modal
        dom['style'].cursor = "auto";
        Metro.activity.close(activity);
        if(callback) {
            callback();
        }
    }));
    }

    public addNetwork(nid : number){
        let ul = document.getElementById("networks")
        let li = document.createElement("li");
        let name = "Network " + (nid+1).toString();
        li.setAttribute('id', name);
        li.appendChild(document.createTextNode(name));
        li.setAttribute("onclick", String(selectednetwork = nid));
        ul.appendChild(li);
    }

    public removeNetwork(nid: number){
        let ul = document.getElementById("networks");
        let name = "Network " + (nid+1).toString();
        let item = document.getElementById(name);
        ul.removeChild(item);
    }

    public toggleDataset(GD: graphData){
        let cid = currentDatasets.indexOf(GD);
        if(cid > 0) {
            currentDatasets.splice(cid, 1);
        } else {
            currentDatasets.push(GD);
        }
    }

    public addGraphData(GD : graphData){
        let ul = document.getElementById("datalist") //In fluctuation Window
        let li = document.createElement("li");
        let name = "Dataset: " + GD.label + " Format: " + GD.datatype
        li.setAttribute('id', name);
        li.appendChild(document.createTextNode(name));
        li.setAttribute("onclick", String(fluxGraph.setTargetData())); //Draw on Graph
        ul.appendChild(li);
    }

    public removeGraphData(nid : number){
        let ul = document.getElementById("networks")
        let li = document.createElement("li");
        let name = "Network " + (nid+1).toString();
        li.setAttribute('id', name);
        li.appendChild(document.createTextNode(name));
        li.setAttribute("onclick", String(selectednetwork = nid));
        ul.appendChild(li);
    }


    public addGraphData(GD :graphData){ //Generates HTML Tile Element in Fluctuation Window
        graphDatasets.push(GD);
        let tileg = document.getElementById("tileg");
        let tile = document.createElement("div");
        tile.setAttribute("id", GD.label);
        tile.setAttribute("data-role", "tile");
        tile.setAttribute("data-size", "small");
        tile.setAttribute("onclick", String(this.toggleDataset(GD)));
        let closebutton = document.createElement("button");
        closebutton.setAttribute("class", "badge-top")
        closebutton.setAttribute("onclick", String(this.removeGraphData(GD)))
        let span = document.createElement("span");
        span.setAttribute("branding-label", GD.label);
        tile.appendChild(span);
        tile.append(closebutton);
        tileg.appendChild(tile);
    }document.getElementById('fluxbar').toggle()

    public removeGraphData(GD: graphData){ //Removes HTML Tile Element in Fluctuation Window
        let gid = graphDatasets.indexOf(GD);
        graphDatasets.splice(gid, 1);
        let cid = currentDatasets.indexOf(GD);
        if(cid > 0) {
            currentDatasets.splice(cid, 1);
        }
        let tileg = document.getElementById("tileg");
        let tile = document.getElementById(GD.label);
        tileg.removeChild(tile);
    }

}

let view = new View(document);


class graphData {
    label: string;
    data: number[];
    datatype: string;
    constructor(l, d, dt){
        this.label = l;
        this.data = d;
        this.datatype = dt;
    }
}

// function drawFluctuationGraph(graphDataArr :graphData[]) { // Initializes Graph
//     let colors = {
//         red: 'rgb(255, 99, 132)',
//         orange: 'rgb(255, 159, 64)',
//         yellow: 'rgb(255, 205, 86)',
//         green: 'rgb(75, 192, 192)',
//         blue: 'rgb(54, 162, 235)',
//         purple: 'rgb(153, 102, 255)',
//         grey: 'rgb(201, 203, 207)'
//     }
//
//     let datasets = [];
//
//     // Get Graph Type still need to make this
//
//
//
//
//     // for (var i = 0; i < graphDataArr.length; i++) {
//     //     // Per Dataset
//     //     let adjdata = [];
//     //     if (graphDataArr[i].datatype == 'bfactor') adjdata = graphDataArr[i].data;
//     //     let data = {
//     //         label: graphDataArr[i].label,
//     //         fill: false,
//     //         backgroundColor: colors[i%7],
//     //         borderColor: colors[i%7],
//     //         data: graphDataArr[i].data,
//     //     }
//     //     datasets.push(data);
//     // }
//
//     // let labels = datasets.map(d => d.label);
//
//     let title = "Comparison";
//     let xaxislabel = 'hi';
//     let yaxislabel = 'bye';
//
//     let GraphSettings = {
//         type: 'line',
//         data: {},
//         options: {
//             responsive: true,
//             title: {
//                 display: true,
//                 text: title
//             },
//             tooltips: {
//                 mode: 'y',
//                 intersect: false
//             },
//             hover: {
//                 mode: 'y',
//                 intersect: false
//             },
//             scales: {
//                 xAxes: [{
//                     display: true,
//                     scaleLabel: {
//                         display: true,
//                         labelString: xaxislabel
//                     }
//                 }],
//                 yAxes: [{
//                     display: true,
//                     scaleLabel: {
//                         display: true,
//                         labelString: yaxislabel
//                     }
//                 }]
//             }
//         }
//     };
//
//     let canvas = <HTMLCanvasElement> document.getElementById('fluctuations');
//     let ctx = canvas.getContext("2d");
//     let fluctuationChart = new Chart(ctx, GraphSettings);
// }

let colors = {
    red: 'rgb(255, 99, 132)',
    orange: 'rgb(255, 159, 64)',
    yellow: 'rgb(255, 205, 86)',
    green: 'rgb(75, 192, 192)',
    blue: 'rgb(54, 162, 235)',
    purple: 'rgb(153, 102, 255)',
    grey: 'rgb(201, 203, 207)'
}

// Get Graph Type still need to make this

// for (var i = 0; i < graphDataArr.length; i++) {
//     // Per Dataset
//     let adjdata = [];
//     if (graphDataArr[i].datatype == 'bfactor') adjdata = graphDataArr[i].data;
//     let data = {
//         label: graphDataArr[i].label,
//         fill: false,
//         backgroundColor: colors[i%7],
//         borderColor: colors[i%7],
//         data: graphDataArr[i].data,
//     }
//     datasets.push(data);
// }

// let labels = datasets.map(d => d.label);
class fluxGraph {
    title: string;
    xaxislabel: string;
    yaxislabel: string;
    data: graphData[];
    type: string;
    temp: number;
    chart: Chart;
    targetdata: string;

    constructor(config, type) {
        this.title = 'fluxgraph';
        this.xaxislabel = 'x-axis';
        this.yaxislabel = 'y-axis';
        this.type = type;
        this.temp = 0;
        let ctx = (document.getElementById('fluctuations') as HTMLCanvasElement).getContext('2d');
        this.chart = new Chart(ctx, config);
    };

    setType(type: string) { //type can be bfactor or rmsf
        this.type = type;
    };

    setTemp(temp: number) { // Kelvin
        this.temp = temp;
    };

    setTargetData(GD: graphData) {
        let newData = [GD];
        ///DFSDKFKSDJFKSDJ
        this.addDatatoGraph(newData);
    };

    addDatatoGraph(GD: graphData){

    }

    writeConfig() {

    };

    toggleSidebar() {
        let sb = document.getElementById('fluxbar');
        // sb.toggle
    }
}

let fluxconfig = {
    type: 'line',
    data: {},
    options: {
        responsive: true,
        title: {
            display: true,
            text: this.title
        },
        tooltips: {
            mode: 'y',
            intersect: false
        },
        hover: {
            mode: 'y',
            intersect: false
        },
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: this.xaxislabel
                }
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: this.yaxislabel
                }
            }]
        }
    }
}
let tmp = {};
const emptyfluxconfig = Object.assign(tmp, fluxconfig);

var config = {
    type: 'line',
    data: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
        datasets: [{
            backgroundColor: colors.red,
            borderColor: colors.red,
            data: [
                50,
                45,
                40,
                12,
                0,
                87,
                38
            ],
            fill: false,
        }]
    },
    options: {
        responsive: true,
        title: {
            display: true,
            text: 'Chart.js Line Chart'
        },
        tooltips: {
            mode: 'index',
            intersect: false,
        },
        hover: {
            mode: 'nearest',
            intersect: true
        },
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Month'
                }
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Value'
                }
            }]
        }
    }
};

function drawChart(){
    let ctx = (document.getElementById('fluctuations') as HTMLCanvasElement).getContext('2d');
    new Chart(ctx, config);
}
