/*
# This file is part of the Waymarked Trails Map Project
# Copyright (C) 2011-2012 Sarah Hoffmann
#
# This is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
#
# Functions for route sidebar.
*/


function setupRouteView(m) {
    m.events.register('moveend', m, reloadRoutes);
    var myStyles = new OpenLayers.StyleMap({
        "default": new OpenLayers.Style({
            display: "none"
        }),
        "visible": new OpenLayers.Style({
            strokeColor: "#d3ff05",
            strokeWidth: 10,
            strokeOpacity : 0.6,
            graphicZIndex: 1,
            display: true
        }),
        "single": new OpenLayers.Style({
           strokeColor: "#d3ff05",
            strokeWidth: 10,
            strokeOpacity : 0.6,
            graphicZIndex: 1
        })

    });  

    routeLayer = new OpenLayers.Layer.Vector("Route",
                                  { styleMap : myStyles });
    m.addLayer(routeLayer);
    if (Osgende.MapConfig.showroute >= 0) {
        WMTSidebar.show('routes');
        if(Osgende.MapConfig.ismobile) {
            toggleSmallRouteView();
        }
        showRouteInfo(Osgende.MapConfig.showroute, loadRoutes);
    } 
    
}

/*
    Utility function to sort the route list according to distance
*/
function sortTable(tablename){
    var tbl = document.getElementById(tablename).tBodies[0];
    var store = [];
    for(var i=0, len=tbl.rows.length; i<len; i++){
        var row = tbl.rows[i];
        var sortnr = parseFloat(row.cells[0].textContent || row.cells[0].innerText);
        if(!isNaN(sortnr)) store.push([sortnr, row]);
    }
    store.sort(function(x,y){
        return x[0] - y[0];
    });
    for(var i=0, len=store.length; i<len; i++){
        tbl.appendChild(store[i][1]);
    }
    store = null;
}


var routeviewcounter = 0;
var firstView = false;
function loadRoutes() {
    var map = Osgende.RouteMap.map;
    var bounds = map.getExtent();
    
    // Make sure relations below header and footer
    // is not shown in route list
    var resolution = map.getResolution();
    var topHeader = ($('#page-header').height() + $('page-subheader').height() + 20)*resolution;
    var maxY = bounds.top - topHeader;
    var footer = $('#map_footer')[0];
    var bottomFooter = 0;
    if (footer.offsetWidth > 0) {
        bottomFooter = (footer.offsetHeight + 20)*resolution;
    }
    var minY = bounds.bottom + bottomFooter;
    bounds = new OpenLayers.Bounds(bounds.left, minY, bounds.right, maxY);        

    bounds.transform(map.projection, map.displayProjection);
    $("#sb-routes .route-content").addClass("invisible");
    $("#sidebar-header .infobtn").addClass("invisible");
    $('#routeloader').removeClass('invisible');
    routeviewcounter++;
    var sid = routeviewcounter;
    $.get(Osgende.MapConfig.routeinfo_baseurl +'?bbox=' + bounds.toBBOX(),
            function (data) {
                if (routeviewcounter == sid) {
                    $('#routeloader').addClass('invisible');
                    var div = jQuery("<div>").append(data);
                    
                    // Should we show default title or shoud searchArea() handle the title?
                    if(Osgende.MapConfig.showarea == -1 || firstView){ 
                        $('#empty-title').html(div.find('.route-list-header').html());
                        firstView = true; //Always stay true
                    }
                    firstView = true;

                    $('#empty-title').removeClass('invisible');
                    $('#routecontent').html(div.find('.route-list-content'));
                    
                    // Get all <td>'s from data and get route id
                    // .routeDist only exist on mobile
                    var numDone = 0; // Keep track of calculated distances
                    $.each($('.routeDist'), function(index, value) {
                        
                        var routeid = value.id;     
                        
                        var options = {enableHighAccuracy:true, maximumAge:0, timeout:7000};
                        navigator.geolocation.getCurrentPosition(function(position){
                            // Calc min distance from user to end/start point with this route id
                            $.getJSON(Osgende.MapConfig.routeinfo_baseurl + routeid + '/dist?' + 'lat=' + position.coords.latitude + '&lon=' + position.coords.longitude, function(data) {
                                
                                numDone++;

                                var length = 0;
                                if (data.minDistance !== null) {
                                    
                                    // Set distance in <td>
                                    if(data.minDistance>0)  {
                                        var length = data.minDistance;
                                    }
                                    $('#' + routeid).html(length);

                                }
                                else {
                                    $('#' + routeid).html(length);   
                                }
                                $('#' + routeid).css("visibility", "hidden");

                                // Check if this is the last row 
                                if(numDone == $('.routeDist').length ) {

                                    // Sort all tables as distances get ready
                                    // Not the most effective way of doing this, but 
                                    // we are only dealing with small tables
                                    $.each($('.routelist'), function(index, value) { 
                                        sortTable(value.id);   
                                    });

                                    // Reformat distances after sorting them
                                    $.each($('.routeDist'), function(index, value) { 
                                        var length = $('#' + value.id).html();
                                        if (length > 999) {
                                            $('#' + value.id).html(Math.round(length/1000) + " km");
                                        }
                                        else {
                                            $('#' + value.id).html(length + " m");
                                        } 
                                        $('#' + value.id).css("visibility", "visible");
                                    });
                                }

                                
                            });
                        },
                        function(){
                            // Handle error
                            $('#' + routeid).html(""); // Not able to get min distance
                        }, options
                        );                   
                     });

                    $('#routecontent').removeClass("invisible");
                    var link = div.find('.routelink').attr('href');
                    var styleloader = new OpenLayers.Protocol.HTTP({
                            url: link,
                            format: new OpenLayers.Format.GeoJSON(),
                            callback: function (response) {
                                        if (routeviewcounter == sid && response.features !== null) {
                                            routeLayer.style = null;
                                            routeLayer.addFeatures(response.features);
                                        }
                                      }
                        });
                    styleloader.read();
                }
            }
          );
    routeLayer.removeAllFeatures();
  
}


function reloadRoutes() {
    if (!($('#routecontent, #sidebar, #sb-routes').hasClass('invisible'))) {
        loadRoutes();
    }
}

function routeInfoToggleSection() {
    if (!$(this).hasClass('section-hidden')) {
        $('.ui-icon', this).toggleClass('ui-icon-arrow-r ui-icon-arrow-d');
        $(this).next().toggleClass('invisible');
    }
}

function showRouteInfo(osmid, backfunc) {
    $("#sidebar-header .infobtn").removeClass("invisible");
    $('#routeloader').removeClass('invisible');
    $('#sb-routes .route-content').addClass('invisible');
    $('#sbback').off();
    $('#sbback').click(backfunc);
    routeviewcounter++;
    var sid = routeviewcounter;
    $.get(Osgende.MapConfig.routeinfo_baseurl + osmid + '/info',
        function (data) {
            if (routeviewcounter == sid) {
                $('#routeloader').addClass('invisible');
                var div = jQuery("<div>").append(data);
                $('#empty-title').html(div.find('.route-info-header').html());
                $('#empty-title').removeClass('invisible');
                $('#routeinfocontent').html(div.find('.route-info-content'));
                
                // Reset header to name of relation
                var tmp = $('.route-info-title').html();
                $('#empty-title').html(tmp);
                
                // manipulate headers to make them closable
                $('#routeinfocontent h2').each(function (idx) {
                    var oldcontent = $(this).html();
                    $(this).html('<span class="ui-icon ui-icon-alt"></span><span class="title-text">'+ oldcontent + '</span>');
                    if ($(this).hasClass('section-closed')) {
                        $('.ui-icon', this).addClass('ui-icon-arrow-r');
                        $(this).next().addClass('invisible');
                    } else {
                        $('.ui-icon', this).addClass('ui-icon-arrow-d');
                    }
                    $(this).click(routeInfoToggleSection);
                });
                $('#routeinfocontent').removeClass("invisible");
                // Only if elevation profile is turned on
                if (typeof createElevationProfile === 'function') {
                    createElevationProfile(osmid); 
                }
                routeLayer.removeAllFeatures();
                var styleloader = new OpenLayers.Protocol.HTTP({
                        url: Osgende.MapConfig.routeinfo_baseurl + osmid + '/json',
                        format: new OpenLayers.Format.GeoJSON(),
                        callback: function (response) {
                            routeLayer.style = routeLayer.styleMap.styles.single.defaultStyle;
                            routeLayer.addFeatures(response.features);
                            Osgende.RouteMap.map.zoomToExtent(routeLayer.getDataExtent());
                          },
                        scope: this
                        });
                styleloader.read();
            }
        });
}

function toggleSmallRouteView() {
    WMTSidebar.toggleMini();
    // switch content of #route-info-title and #empty-title
    var tmp = $('.route-info-title').html();
    $('.route-info-title').html($('#empty-title').html());
    $('#empty-title').html(tmp);
}



function highlightRoute(osmid) {
    for(var i=0, len=routeLayer.features.length; i<len; i++) {
        if (routeLayer.features[i].attributes.id == osmid) {
            routeLayer.features[i].renderIntent = 'visible';
            routeLayer.drawFeature(routeLayer.features[i]);
            break;
        }
    }
    routeLayer.redraw();
}

function unhighlightRoute(osmid) {
    for(var i=0, len=routeLayer.features.length; i<len; i++) {
        if (routeLayer.features[i].attributes.id == osmid) {
            routeLayer.features[i].renderIntent = 'default';
            routeLayer.drawFeature(routeLayer.features[i]);
            break;
        }
    }
}



$('#tb-routes').click(function() {
    WMTSidebar.show('routes');
    loadRoutes();
});

$('#sbsmall').click(toggleSmallRouteView);

function openRouteView() {
    WMTSidebar.show('routes');
    loadRoutes();
}
