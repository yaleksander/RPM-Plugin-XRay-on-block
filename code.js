import { RPM } from "../path.js"
import { THREE } from "../../System/Globals.js";

const pluginName = "Hide object on block view";

var eraseRadius = RPM.Manager.Plugins.getParameter(pluginName, "Erase radius");
var wallsList = [];
var obj3dList = [];
var eraseFloor = false;
var eraseWalls = true;
var eraseObj3D = true;
var mapID = 0;

const extraVert = "\
varying vec3 viewBlockPlugin_vPos;\n\
varying vec3 viewBlockPlugin_vNormal;\n\
varying vec3 viewBlockPlugin_camPos;\n\n\
void main ()\n\
{\n\
	viewBlockPlugin_vPos = vec3(inverse(viewMatrix) * modelViewMatrix * vec4(position, 1.0));\n\
	viewBlockPlugin_vNormal = normal;\n\
	viewBlockPlugin_camPos = cameraPosition;\n\
";
const extraFrag = "\
uniform vec3 viewBlockPlugin_tgtPos;\n\
uniform float viewBlockPlugin_radius;\n\
uniform float viewBlockPlugin_isFloor;\n\
varying vec3 viewBlockPlugin_camPos;\n\
varying vec3 viewBlockPlugin_vPos;\n\
varying vec3 viewBlockPlugin_vNormal;\n\n\
void main ()\n\
{\n\
	if (viewBlockPlugin_radius > 0.0)\n\
	{\n\
		vec3 viewBlockPlugin_v1 = viewBlockPlugin_tgtPos - viewBlockPlugin_camPos;\n\
		vec3 viewBlockPlugin_v2 = viewBlockPlugin_vPos - viewBlockPlugin_camPos;\n\
		float viewBlockPlugin_openingAngle = atan(viewBlockPlugin_radius, length(viewBlockPlugin_v1));\n\
		if (acos(dot(normalize(viewBlockPlugin_v1), normalize(viewBlockPlugin_v2))) < viewBlockPlugin_openingAngle)\n\
		{\n\
			if (length(viewBlockPlugin_v2) < length(viewBlockPlugin_v1) * 2.0)\n\
			{\n\
				if (viewBlockPlugin_isFloor == 0.0)\n\
					discard;\n\
				else if (length(viewBlockPlugin_vNormal.xz) > 0.0)\n\
					discard;\n\
			}\n\
		}\n\
	}\n\
";

setInterval(function ()
{
	if (RPM.Manager.Stack.top instanceof RPM.Scene.Map && !RPM.Scene.Map.current.loading)
	{
		if (mapID != RPM.Scene.Map.current.id)
		{
			wallsList = [];
			obj3dList = [];
			const walls = RPM.Scene.Map.current.texturesWalls;
			const obj3d = RPM.Scene.Map.current.texturesObjects3D;
			for (var i = 0; i < walls.length; i++)
				if (!!walls[i])
					wallsList.push(walls[i]);
			for (var i = 0; i < obj3d.length; i++)
				if (!!obj3d[i])
					obj3dList.push(obj3d[i]);
			mapID = RPM.Scene.Map.current.id;
		}
		for (var i = 0; i < RPM.Scene.Map.current.maxObjectsID; i++)
		{
			RPM.Core.MapObject.search(i, (result) =>
			{
				if (!!result && !!result.object.mesh)
					result.object.mesh.viewBlockPlugin_isMapObj = true;
			}, RPM.Core.ReactionInterpreter.currentObject);
		}
	}
}, 1000);

RPM.Scene.Map.prototype.updateCameraHiding = function (pointer)
{
	const c = this.scene.children;
	for (var i = 1; i < c.length; i++)
	{
		if (!c[i].material || !c[i].material.userData || !c[i].material.userData.uniforms)
			continue;
		c[i].material.userData.uniforms.viewBlockPlugin_radius = {value: 0};
	}
	RPM.Manager.GL.raycaster.setFromCamera(pointer, this.camera.getThreeCamera());
	const intersects = RPM.Manager.GL.raycaster.intersectObjects(c);
	for (var i = 0; i < intersects.length; i++)
	{
		if (Math.ceil(intersects[i].distance) + 5 < this.camera.distance)
		{
			const w = wallsList.includes(intersects[i].object.material);
			const o = obj3dList.includes(intersects[i].object.material);
			const m = intersects[i].object.viewBlockPlugin_isMapObj;
			if ((eraseWalls && w) || (eraseObj3D && o) || (m && intersects[i].object.viewBlockPlugin_erase) || (eraseFloor && !w && !m && !o))
			{
				intersects[i].object.material.userData.uniforms.viewBlockPlugin_isFloor = {value: (w || m || o) ? 0 : 1};
				intersects[i].object.material.userData.uniforms.viewBlockPlugin_radius = {value: eraseRadius * RPM.Datas.Systems.SQUARE_SIZE};
				intersects[i].object.material.userData.uniforms.viewBlockPlugin_tgtPos = {value: this.camera.target.position};
			}
		}
	}
}

function overwriteShaders()
{
	if (!!RPM.Manager.GL.SHADER_FIX_VERTEX && !!RPM.Manager.GL.SHADER_FIX_FRAGMENT && !!RPM.Manager.GL.SHADER_FACE_VERTEX && !!RPM.Manager.GL.SHADER_FACE_FRAGMENT)
	{
		const vertFix = RPM.Manager.GL.SHADER_FIX_VERTEX;
		const vertFixBegin = vertFix.search(/void\smain\((void)*\)/);
		const vertFixEnd = vertFix.indexOf("{", vertFixBegin) + 1;
		const fragFix = RPM.Manager.GL.SHADER_FIX_FRAGMENT;
		const fragFixBegin = fragFix.search(/void\smain\((void)*\)/);
		const fragFixEnd = fragFix.indexOf("{", fragFixBegin) + 1;
		const vertFace = RPM.Manager.GL.SHADER_FACE_VERTEX;
		const vertFaceBegin = vertFace.search(/void\smain\((void)*\)/);
		const vertFaceEnd = vertFace.indexOf("{", vertFaceBegin) + 1;
		const fragFace = RPM.Manager.GL.SHADER_FACE_FRAGMENT;
		const fragFaceBegin = fragFace.search(/void\smain\((void)*\)/);
		const fragFaceEnd = fragFace.indexOf("{", fragFaceBegin) + 1;
		if (vertFaceBegin < 0 || vertFaceEnd < 0 || fragFaceBegin < 0 || fragFaceEnd < 0 || vertFixBegin < 0 || vertFixEnd < 0 || fragFixBegin < 0 || fragFixEnd < 0)
		{
			RPM.Common.Platform.showErrorMessage("There is an error in your shader files. Fix it before you can use this plugin.");
			RPM.Common.Platform.quit();
		}
		RPM.Manager.GL.SHADER_FIX_VERTEX = vertFix.substr(0, vertFixBegin) + extraVert + vertFix.substr(vertFixEnd);
		RPM.Manager.GL.SHADER_FIX_FRAGMENT = fragFix.substr(0, fragFixBegin) + extraFrag + fragFix.substr(fragFixEnd);
		RPM.Manager.GL.SHADER_FACE_VERTEX = vertFace.substr(0, vertFaceBegin) + extraVert + vertFace.substr(vertFaceEnd);
		RPM.Manager.GL.SHADER_FACE_FRAGMENT = fragFace.substr(0, fragFaceBegin) + extraFrag + fragFace.substr(fragFaceEnd);
	}
	else
		setTimeout(overwriteShaders, 33);
}
overwriteShaders();

RPM.Manager.Plugins.registerCommand(pluginName, "Set erase radius", (radius) =>
{
	eraseRadius = radius;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Filter map", (erase) =>
{
	eraseFloor = erase;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Filter walls", (erase) =>
{
	eraseWalls = erase;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Filter static 3D objects", (erase) =>
{
	eraseObj3D = erase;
});

RPM.Manager.Plugins.registerCommand(pluginName, "Filter map object", (id, erase) =>
{
	if (id < 0)
		id = RPM.Core.ReactionInterpreter.currentObject.id;
	RPM.Core.MapObject.search(id, (result) =>
	{
		if (!!result && !!result.object.mesh)
			result.object.mesh.viewBlockPlugin_erase = erase;
	}, RPM.Core.ReactionInterpreter.currentObject);
});
