/*
    Copyright 2010
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXGraph.  If not, see <http://www.gnu.org/licenses/>.
*/

/*jshint bitwise: false, curly: true, debug: false, eqeqeq: true, devel: false, evil: false,
  forin: false, immed: true, laxbreak: false, newcap: false, noarg: true, nonew: true, onevar: true,
   undef: true, white: true, sub: false*/
/*global JXG: true, AMprocessNode: true */

/**
 * Uses HTML Canvas to implement the rendering methods defined in {@link JXG.AbstractRenderer}.
 * @class JXG.AbstractRenderer
 * @augments JXG.AbstractRenderer
 * @param {HTMLNode} container Reference to a DOM node containing the board.
 * @see JXG.AbstractRenderer
 */
JXG.CanvasRenderer = function (container) {
    var i;

    this.type = 'canvas';

    this.canvasRoot = null;
    this.suspendHandle = null;
    this.canvasId = JXG.Util.genUUID();

    this.canvasNamespace = null;

    this.container = container;
    this.container.style.MozUserSelect = 'none';

    this.container.style.overflow = 'hidden';
    if (this.container.style.position === '') {
        this.container.style.position = 'relative';
    }

    this.container.innerHTML = ['<canvas id="', this.canvasId, '" width="', this.container.style.width, '" height="', this.container.style.height, '"><', '/canvas>'].join('');
    this.canvasRoot = document.getElementById(this.canvasId);
    this.context =  this.canvasRoot.getContext('2d');

    this.dashArray = [[2, 2], [5, 5], [10, 10], [20, 20], [20, 10, 10, 10], [20, 5, 10, 5]];
};

JXG.CanvasRenderer.prototype = new JXG.AbstractRenderer();

JXG.extend(JXG.CanvasRenderer, /** @lends JXG.CanvasRenderer.prototype */ {

    /* **************************
     *   private methods only used in this renderer. Should not be called from outside.
     * **************************/

    /*
     * _drawFilledPolygon, _translateShape, _rotateShape
     * are necessary for drawing arrow heads.
     */
    _drawFilledPolygon: function (shape) {
        var i, len = shape.length,
            context = this.context;

        if (len > 0) {
            context.beginPath();
            context.moveTo(shape[0][0], shape[0][1]);
            for (i = 0; i < len; i++) {
                if (i > 0) {
                    context.lineTo(shape[i][0], shape[i][1]);
                }
            }
            context.lineTo(shape[0][0], shape[0][1]);
            context.fill();
        }
    },

    /*
     * Sets color and opacity for filling
     * and does the filling
     */

    _fill: function (el) {
        var context = this.context;

        context.save();
        if (this._setColor(el, 'fill')) {
            context.fill();
        }
        context.restore();
    },

    _rotatePoint: function (ang, x, y) {
        return [
            (x * Math.cos(ang)) - (y * Math.sin(ang)),
            (x * Math.sin(ang)) + (y * Math.cos(ang))
        ];
    },

    _rotateShape: function (shape, ang) {
        var i, rv = [], len = shape.length;

        if (len <= 0) {
            return shape;
        }

        for (i = 0; i < len; i++) {
            rv.push(this._rotatePoint(ang, shape[i][0], shape[i][1]));
        }

        return rv;
    },

    /*
     * Sets color and opacity for filling and stroking
     */
    _setColor: function (el, type) {
        var hasColor = true, isTrace = false;
        if (!JXG.exists(el.board) || !JXG.exists(el.board.highlightedObjects)) {
            // This case handles trace elements.
            // To make them work, we simply neglect highlighting.
            isTrace = true;
        }

        if (type === 'fill') {
            if (!isTrace && JXG.exists(el.board.highlightedObjects[el.id])) {
                if (el.visProp.highlightFillColor !== 'none') {
                    this.context.globalAlpha = el.visProp.highlightFillOpacity;
                    this.context.fillStyle = el.visProp.highlightFillColor;
                } else {
                    hasColor = false;
                }
            } else {
                if (el.visProp.fillColor !== 'none') {
                    this.context.globalAlpha = el.visProp.fillOpacity;
                    this.context.fillStyle = el.visProp.fillColor;
                } else {
                    hasColor = false;
                }
            }
        } else {
            if (!isTrace && JXG.exists(el.board.highlightedObjects[el.id])) {
                if (el.visProp.highlightStrokeColor !== 'none') {
                    this.context.globalAlpha = el.visProp.highlightStrokeOpacity;
                    this.context.strokeStyle = el.visProp.highlightStrokeColor;
                } else {
                    hasColor = false;
                }
            } else {
                if (el.visProp.strokeColor !== 'none') {
                    this.context.globalAlpha = el.visProp.strokeOpacity;
                    this.context.strokeStyle = el.visProp.strokeColor;
                } else {
                    hasColor = false;
                }
            }
            this.context.lineWidth = parseFloat(el.visProp.strokeWidth);
        }
        return hasColor;
    },


    /*
     * Sets color and opacity for drawing paths and lines
     * and draws the paths and lines.
     */
    _stroke: function (el) {
        var context = this.context;

        context.save();

        if (el.visProp.dash > 0) {
            // TODO - dash styles for canvas
        } else {
            this.context.lineDashArray = [];
        }

        if (this._setColor(el, 'stroke')) {
            context.stroke();
        }
        context.restore();
    },


    _translateShape: function (shape, x, y) {
        var i, rv = [], len = shape.length;

        if (len <= 0) {
            return shape;
        }

        for (i = 0; i < len; i++) {
            rv.push([ shape[i][0] + x, shape[i][1] + y ]);
        }

        return rv;
    },

    /* ******************************** *
     *    Point drawing and updating    *
     * ******************************** */

    // documented in AbstractRenderer
    drawPoint: function (el) {
        var f = el.visProp.face,
            size = el.visProp.size,
            scr = el.coords.scrCoords,
            sqrt32 = size * Math.sqrt(3) * 0.5,
            s05 = size * 0.5,
            stroke05 = parseFloat(el.visProp.strokeWidth) / 2.0,
            context = this.context;

        if (size <= 0) {
            return;
        }

        switch (f) {
            case 'cross':  // x
            case 'x':
                context.beginPath();
                context.moveTo(scr[1] - size, scr[2] - size);
                context.lineTo(scr[1] + size, scr[2] + size);
                context.moveTo(scr[1] + size, scr[2] - size);
                context.lineTo(scr[1] - size, scr[2] + size);
                context.closePath();
                this._stroke(el);
                break;
            case 'circle': // dot
            case 'o':
                context.beginPath();
                context.arc(scr[1], scr[2], size + 1 + stroke05, 0, 2 * Math.PI, false);
                context.closePath();
                this._fill(el);
                this._stroke(el);
                break;
            case 'square':  // rectangle
            case '[]':
                if (size <= 0) {
                    break;
                }

                context.save();
                if (this._setColor(el, 'stroke')) {
                    if (JXG.exists(el.board.highlightedObjects[el.id])) {
                        context.fillStyle = el.visProp.highlightStrokeColor;
                    } else {
                        context.fillStyle = el.visProp.strokeColor;
                    }
                    context.fillRect(scr[1] - size - stroke05, scr[2] - size - stroke05, size * 2 + 3 * stroke05, size * 2 + 3 * stroke05);
                }
                context.restore();
                context.save();
                this._setColor(el, 'fill');
                context.fillRect(scr[1] - size + stroke05, scr[2] - size + stroke05, size * 2 - stroke05, size * 2 - stroke05);
                context.restore();
                break;
            case 'plus':  // +
            case '+':
                context.beginPath();
                context.moveTo(scr[1] - size, scr[2]);
                context.lineTo(scr[1] + size, scr[2]);
                context.moveTo(scr[1], scr[2] - size);
                context.lineTo(scr[1], scr[2] + size);
                context.closePath();
                this._stroke(el);
                break;
            case 'diamond':   // <>
            case '<>':
                context.beginPath();
                context.moveTo(scr[1] - size, scr[2]);
                context.lineTo(scr[1], scr[2] + size);
                context.lineTo(scr[1] + size, scr[2]);
                context.lineTo(scr[1], scr[2] - size);
                context.closePath();
                this._fill(el);
                this._stroke(el);
                break;
            case 'triangleup':
            case 'a':
            case '^':
                context.beginPath();
                context.moveTo(scr[1], scr[2] - size);
                context.lineTo(scr[1] - sqrt32, scr[2] + s05);
                context.lineTo(scr[1] + sqrt32, scr[2] + s05);
                context.closePath();
                this._fill(el);
                this._stroke(el);
                break;
            case 'triangledown':
            case 'v':
                context.beginPath();
                context.moveTo(scr[1], scr[2] + size);
                context.lineTo(scr[1] - sqrt32, scr[2] - s05);
                context.lineTo(scr[1] + sqrt32, scr[2] - s05);
                context.closePath();
                this._fill(el);
                this._stroke(el);
                break;
            case 'triangleleft':
            case '<':
                context.beginPath();
                context.moveTo(scr[1] - size, scr[2]);
                context.lineTo(scr[1] + s05, scr[2] - sqrt32);
                context.lineTo(scr[1] + s05, scr[2] + sqrt32);
                context.closePath();
                this.fill(el);
                this._stroke(el);
                break;
            case 'triangleright':
            case '>':
                context.beginPath();
                context.moveTo(scr[1] + size, scr[2]);
                context.lineTo(scr[1] - s05, scr[2] - sqrt32);
                context.lineTo(scr[1] - s05, scr[2] + sqrt32);
                context.closePath();
                this._fill(el);
                this._stroke(el);
                break;
        }
    },

    // documented in AbstractRenderer
    updatePoint: function (el) {
        this.drawPoint(el);
    },

    /* ******************************** *
     *           Lines                  *
     * ******************************** */

    // documented in AbstractRenderer
    drawLine: function (el) {
        var scr1 = new JXG.Coords(JXG.COORDS_BY_USER, el.point1.coords.usrCoords, el.board),
            scr2 = new JXG.Coords(JXG.COORDS_BY_USER, el.point2.coords.usrCoords, el.board);

        JXG.Math.Geometry.calcStraight(el, scr1, scr2);

        this.context.beginPath();
        this.context.moveTo(scr1.scrCoords[1], scr1.scrCoords[2]);
        this.context.lineTo(scr2.scrCoords[1], scr2.scrCoords[2]);
        this._stroke(el);

        this.makeArrows(el, scr1, scr2);
    },

    // documented in AbstractRenderer
    updateLine: function (/** Line */ el) {
        this.drawLine(el);
    },

    // documented in AbstractRenderer
    drawTicks: function (axis) {
        // this function is supposed to initialize the svg/vml nodes in the SVG/VMLRenderer.
        // but in canvas there are no such nodes, hence we just do nothing and wait until
        // updateTicks is called.
    },

    // documented in AbstractRenderer
    updateTicks: function (axis, dxMaj, dyMaj, dxMin, dyMin) {
        var i, c,
            len = axis.ticks.length,
            context = this.context;

        context.beginPath();
        for (i = 0; i < len; i++) {
            c = axis.ticks[i].scrCoords;
            if (axis.ticks[i].major) {
                if ((axis.board.needsFullUpdate || axis.needsRegularUpdate || axis.labels[i].display === 'internal') && axis.labels[i].visProp.visible) {
                    this.drawText(axis.labels[i]);
                }
                context.moveTo(c[1] + dxMaj, c[2] - dyMaj);
                context.lineTo(c[1] - dxMaj, c[2] + dyMaj);
            }
            else {
                context.moveTo(c[1] + dxMin, c[2] - dyMin);
                context.lineTo(c[1] - dxMin, c[2] + dyMin);
            }
        }
        this._stroke(axis);
    },

    /* **************************
     *    Curves
     * **************************/

    // documented in AbstractRenderer
    drawCurve: function (el) {
        this.updatePathStringPrim(el);
    },

    // documented in AbstractRenderer
    updateCurve: function (el) {
        this.drawCurve(el);
    },

    /* **************************
     *    Circle related stuff
     * **************************/

    // documented in AbstractRenderer
    drawEllipse: function (el) {
        var m1 = el.midpoint.coords.scrCoords[1],
            m2 = el.midpoint.coords.scrCoords[2],
            sX = el.board.stretchX,
            sY = el.board.stretchY,
            rX = 2 * el.Radius(),
            rY = 2 * el.Radius(),
            aWidth = rX * sX,
            aHeight = rY * sY,
            aX = m1 - aWidth / 2,
            aY = m2 - aHeight / 2,
            hB = (aWidth / 2) * 0.5522848,
            vB = (aHeight / 2) * 0.5522848,
            eX = aX + aWidth,
            eY = aY + aHeight,
            mX = aX + aWidth / 2,
            mY = aY + aHeight / 2,
            context = this.context;

        if (rX > 0.0 && rY > 0.0 && !isNaN(m1 + m2)) {
            context.beginPath();
            context.moveTo(aX, mY);
            context.bezierCurveTo(aX, mY - vB, mX - hB, aY, mX, aY);
            context.bezierCurveTo(mX + hB, aY, eX, mY - vB, eX, mY);
            context.bezierCurveTo(eX, mY + vB, mX + hB, eY, mX, eY);
            context.bezierCurveTo(mX - hB, eY, aX, mY + vB, aX, mY);
            context.closePath();
            this._fill(el);
            this._stroke(el);
        }
    },

    // documented in AbstractRenderer
    updateEllipse: function (el) {
        return this.drawEllipse(el);
    },

    /* **************************
     *    Polygon
     * **************************/

    // nothing here, using AbstractRenderer implementations

    /* **************************
     *    Text related stuff
     * **************************/

    // already documented in JXG.AbstractRenderer
    displayCopyright: function (str, fontSize) {
        var context = this.context;

        // this should be called on EVERY update, otherwise it won't be shown after the first update
        context.save();
        context.font = fontSize + 'px Arial';
        context.fillStyle = '#aaa';
        context.lineWidth = 0.5;
        context.fillText(str, 10, 2 + fontSize);
        context.restore();
    },

    // already documented in JXG.AbstractRenderer
    drawInternalText: function (el) {
        var fs, context = this.context;

        context.save();
        if (this._setColor(el, 'stroke')) {
            if (JXG.exists(el.board.highlightedObjects[el.id])) {
                context.fillStyle = el.visProp.highlightStrokeColor;
            } else {
                context.fillStyle = el.visProp.strokeColor;
            }
            if (el.visProp.fontSize) {
                if (typeof el.visProp.fontSize === 'function') {
                    fs = el.visProp.fontSize();
                    context.font = (fs > 0 ? fs : 0) + 'px Arial';
                } else {
                    context.font = (el.visProp.fontSize) + 'px Arial';
                }
            }

            this.transformImage(el, el.transformations);
            context.fillText(el.plaintextStr, el.coords.scrCoords[1], el.coords.scrCoords[2]);
        }
        context.restore();

        return null;
    },

    // already documented in JXG.AbstractRenderer
    updateInternalText: function (el) {
        this.drawInternalText(el);
    },

    // already documented in JXG.AbstractRenderer
    updateTextStyle: function (el) { },

    /* **************************
     *    Image related stuff
     * **************************/

    // already documented in JXG.AbstractRenderer
    drawImage: function (el) {
        el.rendNode = new Image();
        // Store the file name of the image.
        // Before, this was done in el.rendNode.src
        // But there, the file name is expanded to
        // the full url. This may be different from
        // the url computed in updateImageURL().
        el._src = '';
        this.updateImage(el);
    },

    // already documented in JXG.AbstractRenderer
    transformImage: function (el, t) {
        var m, len = t.length,
            ctx = this.context;

        if (len > 0) {
            m = this.joinTransforms(el, t);
            if (Math.abs(JXG.Math.Numerics.det(m)) >= JXG.Math.eps) {
                ctx.transform(m[1][1], m[2][1], m[1][2], m[2][2], m[1][0], m[2][0]);
            }
        }
    },

    // already documented in JXG.AbstractRenderer
    updateImage: function (el) {
        var context = this.context,
            o = JXG.evaluate(el.visProp.fillOpacity),
            paintImg = JXG.bind(function () {
                el.imgIsLoaded = true;
                if (el.size[0] <= 0 || el.size[1] <= 0) {
                    return;
                }
                context.save();
                context.globalAlpha = o;
                // If det(el.transformations)=0, FireFox 3.6. breaks down.
                // This is tested in transformImage
                this.transformImage(el, el.transformations);
                context.drawImage(el.rendNode,
                    el.coords.scrCoords[1],
                    el.coords.scrCoords[2] - el.size[1],
                    el.size[0],
                    el.size[1]);
                context.restore();
            }, this);

        if (this.updateImageURL(el)) {
            el.rendNode.onload = paintImg;
        } else {
            if (el.imgIsLoaded) {
                paintImg();
            }
        }
    },

    // already documented in JXG.AbstractRenderer
    updateImageURL: function (el) {
        var url;

        url = JXG.evaluate(el.url);
        if (el._src !== url) {
            el.imgIsLoaded = false;
            el.rendNode.src = url;
            el._src = url;
            return true;
        }

        return false;
    },

    /* **************************
     *    Grid stuff
     * **************************/







    // documented in AbstractRenderer
    updatePolygonPrim: function (node, el) {
        var scrCoords, i,
            len = el.vertices.length,
            context = this.context;

        if (len <= 0) {
            return;
        }

        context.beginPath();
        scrCoords = el.vertices[0].coords.scrCoords;
        context.moveTo(scrCoords[1], scrCoords[2]);
        for (i = 1; i < len; i++) {
            scrCoords = el.vertices[i].coords.scrCoords;
            context.lineTo(scrCoords[1], scrCoords[2]);
        }
        context.closePath();

        this._fill(el);    // The edges of a polygon are displayed separately (as segments).
    },




    setShadow: function (el) {
        if (el.visPropOld.shadow === el.visProp.shadow) {
            return;
        }

        // not implemented yet
        // we simply have to redraw the element
        // probably the best way to do so would be to call el.updateRenderer(), i think.

        el.visPropOld.shadow = el.visProp.shadow;
    },

    setGradient: function (el) {
        var col, op;

        op = JXG.evaluate(el.visProp.fillOpacity);
        op = (op > 0) ? op : 0;

        col = JXG.evaluate(el.visProp.fillColor);
    },

    updateGradient: function (el) {
        // see drawGradient
    },

    hide: function (el) {
        // sounds odd for a pixel based renderer but we need this for html texts
        if (JXG.exists(el.rendNode)) {
            el.rendNode.style.visibility = "hidden";
        }
    },

    show: function (el) {
        // sounds odd for a pixel based renderer but we need this for html texts
        if (JXG.exists(el.rendNode)) {
            el.rendNode.style.visibility = "inherit";
        }
    },

    remove: function (shape) {
        // sounds odd for a pixel based renderer but we need this for html texts
        if (JXG.exists(shape) && JXG.exists(shape.parentNode)) {
            shape.parentNode.removeChild(shape);
        }
    },

    suspendRedraw: function () {
        this.context.save();
        this.context.clearRect(0, 0, this.canvasRoot.width, this.canvasRoot.height);
        this.displayCopyright(JXG.JSXGraph.licenseText, 12);
    },

    unsuspendRedraw: function () {
        this.context.restore();
    },

    setDashStyle: function () {
        // useless
    },

    setGridDash: function () {
        // useless
    },

    makeArrows: function (el, scr1, scr2) {
        // not done yet for curves and arcs.
        var arrowHead = [
            [ 2, 0 ],
            [ -10, -4 ],
            [ -10, 4]
        ],
            arrowTail = [
                [ -2, 0 ],
                [ 10, -4 ],
                [ 10, 4]
            ],
            x1, y1, x2, y2, ang,
            context = this.context;

        if (el.visProp.strokeColor !== 'none' && (el.visProp.lastArrow || el.visProp.firstArrow)) {
            if (el.elementClass === JXG.OBJECT_CLASS_LINE) {
                x1 = scr1.scrCoords[1];
                y1 = scr1.scrCoords[2];
                x2 = scr2.scrCoords[1];
                y2 = scr2.scrCoords[2];
            } else {
                return;
            }

            context.save();
            if (this._setColor(el, 'stroke')) {
                if (JXG.exists(el.board.highlightedObjects[el.id])) {
                    context.fillStyle = el.visProp.highlightStrokeColor;
                } else {
                    context.fillStyle = el.visProp.strokeColor;
                }
                ang = Math.atan2(y2 - y1, x2 - x1);
                if (el.visProp.lastArrow) {
                    this._drawFilledPolygon(this._translateShape(this._rotateShape(arrowHead, ang), x2, y2));
                }

                if (el.visProp.firstArrow) {
                    this._drawFilledPolygon(this._translateShape(this._rotateShape(arrowTail, ang), x1, y1));
                }
            }
            context.restore();
        }
    },

    updatePathStringPrim: function (el) {
        var symbm = 'M',
            symbl = 'L',
            nextSymb = symbm,
            maxSize = 5000.0,
            i, scr,
            isNoPlot = (el.curveType !== 'plot'),
            len,
            context = this.context;

        if (el.numberPoints <= 0) {
            return;
        }

        if (isNoPlot && el.board.options.curve.RDPsmoothing) {
            el.points = JXG.Math.Numerics.RamenDouglasPeuker(el.points, 0.5);
        }
        len = Math.min(el.points.length, el.numberPoints);

        context.beginPath();
        for (i = 0; i < len; i++) {
            scr = el.points[i].scrCoords;

            if (isNaN(scr[1]) || isNaN(scr[2])) {  // PenUp
                nextSymb = symbm;
            } else {
                // Chrome has problems with values  being too far away.
                if (scr[1] > maxSize) {
                    scr[1] = maxSize;
                } else if (scr[1] < -maxSize) {
                    scr[1] = -maxSize;
                }

                if (scr[2] > maxSize) {
                    scr[2] = maxSize;
                } else if (scr[2] < -maxSize) {
                    scr[2] = -maxSize;
                }

                if (nextSymb === 'M') {
                    context.moveTo(scr[1], scr[2]);
                } else {
                    context.lineTo(scr[1], scr[2]);
                }
                nextSymb = symbl;
            }
        }
        this._fill(el);
        this._stroke(el);
    },

    setPropertyPrim: function (node, key, val) {
    },

    drawVerticalGrid: function (topLeft, bottomRight, gx, board) {

        // TODO - Canvas: drawVerticalGrid

        var node = this.createPrim('path', 'gridx'),
            gridArr = '';

        while (topLeft.scrCoords[1] < bottomRight.scrCoords[1] + gx - 1) {
            gridArr += [' M ', topLeft.scrCoords[1], ' ', 0, ' L ', topLeft.scrCoords[1], ' ', board.canvasHeight, ' '].join('');
            topLeft.setCoordinates(JXG.COORDS_BY_SCREEN, [topLeft.scrCoords[1] + gx, topLeft.scrCoords[2]]);
        }
        this.updatePathPrim(node, gridArr, board);
        return node;
    },

    drawHorizontalGrid: function (topLeft, bottomRight, gy, board) {

        // TODO - Canvas: drawHorizontalGrid

        var node = this.createPrim('path', 'gridy'),
            gridArr = '';

        while (topLeft.scrCoords[2] <= bottomRight.scrCoords[2] + gy - 1) {
            gridArr += [' M ', 0, ' ', topLeft.scrCoords[2], ' L ', board.canvasWidth, ' ', topLeft.scrCoords[2], ' '].join('');
            topLeft.setCoordinates(JXG.COORDS_BY_SCREEN, [topLeft.scrCoords[1], topLeft.scrCoords[2] + gy]);
        }
        this.updatePathPrim(node, gridArr, board);
        return node;
    },

    // documented in AbstractRenderer
    highlight: function (obj) {
        obj.board.prepareUpdate();
        obj.board.renderer.suspendRedraw();
        obj.board.updateRenderer();
        obj.board.renderer.unsuspendRedraw();
        return this;
    },

    // documented in AbstractRenderer
    noHighlight: function (obj) {
        obj.board.prepareUpdate();
        obj.board.renderer.suspendRedraw();
        obj.board.updateRenderer();
        obj.board.renderer.unsuspendRedraw();
        return this;
    }

});