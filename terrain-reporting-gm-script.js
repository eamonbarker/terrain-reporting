// ==UserScript==
// @name         Terrain Reporting
// @namespace    https://terrain.scouts.com.au/
// @version      0.1
// @description  Reporting for Terrain for leaders to gain better insight in to how the unit is running!
// @author       Hathi (Eamon Barker)
// @match        https://terrain.scouts.com.au/*
// @updateURL    https://raw.githubusercontent.com/eamonbarker/terrain-reporting/main/terrain-reporting-gm-script.js
// @downloadURL  https://raw.githubusercontent.com/eamonbarker/terrain-reporting/main/terrain-reporting-gm-script.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=scouts.com.au
// @require      https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

this.$ = this.jQuery = jQuery.noConflict(true);

(function() {
    'use strict';

    var hathi =
        "     __ \n" +
        " .--()°'.' \n" +
        "'|, . ,' \n" +
        " !_-(_\") \n";

    console.log(hathi);

    function showMenu(){
        showReportScreen();
        console.log("Report Screen Called");
    }

    function addMenuItem (jNode) {
        console.log("Menu found");
        var menu = jNode[0];
        var reportMenuItem = document.createElement('div');
        reportMenuItem.id = "terrain-reporting";
        reportMenuItem.innerHTML = '<div class="NavMenu__menu-group"><div class="v-list-group NavMenu__list-group v-list-group--no-action">' +
            '<div tabindex="0" aria-expanded="false" role="button" class="v-list-group__header v-list-item v-list-item--link theme--light">' +
            '<a href="#" aria-current="page" class="NavMenu__item v-list-item--active v-list-item v-list-item--link theme--light" tabindex="0" router="">' +
            '<div class="v-list-item__content"><div class="v-list-item__title">Reporting</div></div></a></div></div></div>';
        reportMenuItem.addEventListener("click", showMenu, false);
        menu.append(reportMenuItem);
    }

    waitForKeyElements(".NavMenu__menu-container", addMenuItem);

    console.log("Terrain Reporting Loaded. Version: 0.1");

    var myProfile = null;
    var debug = false;
    var csv = true;
    var csvbranch = true;
    var lastuser = localStorage.getItem('CognitoIdentityServiceProvider.6v98tbc09aqfvh52fml3usas3c.LastAuthUser');
    var assists_content = [];
    var leads_content = [];
    var recent_updates = [];
    var participateCount = [];

    var totalMembers = 0;
    var processedMembers = 0;

    const token_url = "https://cognito-idp.ap-southeast-2.amazonaws.com/";
    const origin_url = "https://terrain.scouts.com.au";
    const client_id = "6v98tbc09aqfvh52fml3usas3c";
    //overall metrics url does not work any more = 'https://metrics.terrain.scouts.com.au/units/{0}/members?limit=999&force=1'.format(unit_id)
    // so we need to look up members and loop through them???
    const members_url = 'https://members.terrain.scouts.com.au/units';
    const metrics_url = 'https://metrics.terrain.scouts.com.au/units';
    const achievements_url = 'https://achievements.terrain.scouts.com.au/members'; // /{memberid}/achievements
    const agenda_url = 'https://agenda.terrain.scouts.com.au/units';
    const profile_url = "https://members.terrain.scouts.com.au/profiles";

    var renderingContainers = [];

    function percentBar(percentNum, fractionString) {
        var returnHtml = '<div data-v-3cfe9620="" class="MilestonesCard__progress-container">' +
            '<div data-v-3cfe9620="" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" class="v-progress-linear MilestonesCard__progress-meter v-progress-linear--query v-progress-linear--rounded v-progress-linear--visible theme--light" style="height: 8px;">' +
            '<div class="v-progress-linear__background primary" style="opacity: 0.3; left: 50%; width: ' + percentNum + '%;"></div>' +
            '<div class="v-progress-linear__buffer"></div>' +
            '<div class="v-progress-linear__determinate primary" style="width: 50%;"></div>' +
            '</div>';
        if(fractionString){
            returnHtml += '<div data-v-3cfe9620="" class="MilestonesCard__total">12 / 24</div>';
        }

        returnHtml += '</div>';
        return returnHtml;
    }

    async function getTerrainData(url) {
        var returnData = null;
        lastuser = localStorage.getItem('CognitoIdentityServiceProvider.6v98tbc09aqfvh52fml3usas3c.LastAuthUser');
        let apiResponse = await fetch(url, {
            method: 'GET', mode: 'cors', cache: 'no-cache', credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem("CognitoIdentityServiceProvider.6v98tbc09aqfvh52fml3usas3c."+lastuser+".idToken")
            },
            redirect: 'error', referrerPolicy: 'no-referrer',
        }).catch(err => {
            console.log("Error getting members from API. " + err);
        });
        let resp = apiResponse.json();
        return resp;
    }

    async function getUnits() {
        //Returns a list of IDs for units
        var url = profile_url;
        var units = null;

        await getTerrainData(url).then(data => {
            units = data;
        });
        return units;
    }

    async function generateUnitContainer(profile){
        var unitName = profile.unit.name;
        var section = profile.unit.section;
        var unitId = profile.unit.id;
        var unitHtml = "";
        var headerHtml = "<h1>Unit: " + unitName + "</h1>";

        renderingContainers.push({
            type: "heading",
            key: 0,
            location: "header",
            html: headerHtml,
            section: section,
            render: true});

        console.log("Loading unit " + unitName + "...");
        renderApprovalsRequired(unitId, section);

        var url = "https://metrics.terrain.scouts.com.au/units/" + unitId + "/members?limit=999";
        lastuser = localStorage.getItem('CognitoIdentityServiceProvider.6v98tbc09aqfvh52fml3usas3c.LastAuthUser');

        const response = await fetch(url, {
            method: 'GET', mode: 'cors', cache: 'no-cache',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': localStorage.getItem("CognitoIdentityServiceProvider.6v98tbc09aqfvh52fml3usas3c."+lastuser+".idToken")
            },
            redirect: 'error', referrerPolicy: 'strict-origin-when-cross-origin',
        }).catch(err => {
            console.log("Error getting members from API. " + err);
            getMembersMetricsCache(unitId).then(data => {
                unitHtml = renderUnitTable(data, unitName + " (Cached)", section);
                renderingContainers.push({
                    type: "UnitGrid",
                    key: 5,
                    location: "full",
                    html: unitHtml,
                    section: section,
                    render: true});
            })
        });
        response.json().then(data => {
            unitHtml = renderUnitTable(data, unitName, section);
            renderingContainers.push({
                type: "UnitGrid",
                key: 5,
                location: "full",
                html: unitHtml,
                section: section,
                render: true});
        }).catch(err => {
            console.log("Error getting members from API. " + err);
            getMembersMetricsCache(unitId).then(data => {
                unitHtml = renderUnitTable(data, unitName + " (Cached)", section);
                renderingContainers.push({
                    type: "UnitGrid",
                    key: 5,
                    location: "full",
                    html: unitHtml,
                    section: section,
                    render: true});
            });
        });
    }

    function old_renderContainers(){
        var renderTracker = 0;
        var containersToRender = myProfile.profiles.length * 6;
        if(renderingContainers.length < containersToRender)
        {
            if(renderTracker !== renderingContainers.length)
            {
                renderTracker = renderingContainers.length;
                console.log("Render Container Count: " + renderingContainers.length + ", waiting for " + containersToRender);
            }
            window.setTimeout(renderContainers, 500); /* this checks the flag every 500 milliseconds*/
        }else
        {
            console.log("!!Requests Empty - Time to RENDER!!");
            var container = document.getElementsByClassName("v-main__wrap")[0];
            container = container.getElementsByClassName("container")[0].children[0];
            container.className=""; //Remove the class from the container. The class on basecamp causes layout issues.
            container.innerHTML = "";

            if(renderingContainers.length > 0){
                //Group by section then order the content for rendering
                var sortedContent = renderingContainers.sort((a, b) =>
                                                             a.section.localeCompare(b.section) ||
                                                             a.key - b.key);
                console.log(sortedContent);
                for(var key in sortedContent)
                {
                    container.innerHTML += sortedContent[key].html;
                }
            }
        }
    }

    function renderContainers(){
        var container = document.getElementsByClassName("v-main__wrap")[0];
        container = container.getElementsByClassName("container")[0].children[0];
        container.className=""; //Remove the class from the container. The class on basecamp causes layout issues.
        var currentHtml = container.innerHTML;
        container.innerHTML = "";

        var renderTracker = 0;
        var containersToRender = myProfile.profiles.length * 6;

        if(renderingContainers.length < containersToRender)
        {
            if(renderTracker !== renderingContainers.length)
            {
                renderTracker = renderingContainers.length;
                console.log("Render Container Count: " + renderingContainers.length + ", waiting for " + containersToRender);
                console.log(container);
                container.innerHTML = "";
                container.innerHTML = '<h3>Loading Content</h3>' +
                    percentBar(Math.round((renderingContainers.length/containersToRender)*100), renderingContainers.length + "/" + containersToRender);
            }

            window.setTimeout(renderContainers, 500); /* this checks the flag every 500 milliseconds*/
        }else
        {
            console.log("!!Requests Empty - Time to RENDER!!");
            container.innerHTML = "";
            if(renderingContainers.length > 0){
                //Ensure there is only one of each type of container for each section
                const results = [];
                const map = new Map();
                for (const item of renderingContainers) {
                    if(!map.has(item.section + item.type)){
                        map.set(item.section + item.type, true); // set any value to Map
                        results.push({
                            section: item.section,
                            type: item.type,
                            location: item.location,
                            key: item.key,
                            html: item.html
                        });
                    }
                }
                console.log(results);
                var sectionContent = Object.groupBy(results, result => {return result.section});
                console.log(sectionContent);
                for(var sec in sectionContent) {
                    console.log("Rendering content for: " + sec);
                    var content = [];
                    for(var cont in sectionContent[sec]){
                        content.push(sectionContent[sec][cont]);
                    }
                    var headerContents = content.filter(function(el) {return el.location == "header"});
                    container.innerHTML += headerContents[0].html; //Assume only one Header

                    var columnContents = content.filter(function(el) {return el.location == "column"});

                    var rowContent = "";
                    var col1 = "<div class='col-md-6 col-12'>";
                    var col2 = "<div class='col-md-6 col-12'>";
                    rowContent += "<div class='row'>";

                    function splitArrayEqually(arr, parts=2){
                        //get the total sum of the array
                        let sum = arr.reduce((currentSum, value) => currentSum+value ,0);

                        //get the half sum of the array
                        let partitionedSum = Math.ceil(sum/parts);
                        let start=0, end=0, currentSum=0;
                        let splittedArray=[];

                        //get the index till which the sum is less then equal partitioned sum
                        while(end < arr.length){
                            if(currentSum+arr[end] > partitionedSum){
                                splittedArray.push(arr.slice(start,end));
                                start = end; //start new window from current index
                                currentSum = 0; //make sum =0
                            }
                            //add current end index to sum
                            currentSum += arr[end];
                            end++;
                        }
                        splittedArray.push(arr.slice(start));
                        return splittedArray;
                    }

                    var weightArray = [];
                    var sizedArray = []
                    for(var columnContent in columnContents)
                    {
                        weightArray.push(columnContents[columnContent].html.length);
                        sizedArray.push({size: columnContents[columnContent].html.length, html: columnContents[columnContent].html});
                    }

                    var splitted = splitArrayEqually(weightArray.sort(function(a, b) { return a - b; }), 2);

                    for(var i0 = 0; i0 < splitted[0].length; i0++) {
                        var item0 = splitted[0][i0];
                        col1 += sizedArray.find(({size}) => size === item0).html;
                    }

                    for(var i1 = 0; i1 < splitted[1].length; i1++) {
                        var item1 = splitted[1][i1];
                        col2 += sizedArray.find(({size}) => size === item1).html;
                    }

                    col1 += "</div>";
                    col2 += "</div>";
                    rowContent += col1;
                    rowContent += col2;
                    rowContent += "</div>";
                    container.innerHTML += rowContent;

                    var fullContents = content.filter(function(el) {return el.location == "full"});
                    for(var fullContent in fullContents)
                    {
                        container.innerHTML += fullContents[fullContent].html;
                    }
                }
                container.innerHTML += "<hr />";
            }
        }
    }

    async function showReportScreen(){
        if (document.getElementsByClassName("v-main__wrap")[0] != undefined) {
            console.log("Loading Reports");

            var container = document.getElementsByClassName("v-main__wrap")[0];
            container = container.getElementsByClassName("container")[0].children[0];
            container.className=""; //Remove the class from the container. The class on basecamp causes layout issues.
            container.innerHTML = ""; //Clear page.

            /* var title = document.getElementsByClassName("v-breadcrumbs AppBar__breadcrumbs theme--light")[0]
            .getElementsByClassName("v-breadcrumbs__item--disabled v-breadcrumbs__item v-breadcrumbs__item--disabled")[0]
            .innerHTML;
            console.log(title);*/

            if (myProfile === null) {
                myProfile = await getUnits();
            }
            requiredReady = myProfile.profiles.length;

            for(var u = 0; u < myProfile.profiles.length; u++) { //For each unit
                container.innerHTML += "Loading report for " + myProfile.profiles[u].unit.name + "... <br /><br />";
                generateUnitContainer(myProfile.profiles[u]);
            };
            renderContainers();
        }
    }

    async function getMembersMetricsCache(M) {
        console.log("Getting members from cache");
        const cacheStorage = await caches.open( "workbox-runtime-https://terrain.scouts.com.au/" );
        const request = new Request("https://metrics.terrain.scouts.com.au/units/"+M+"/members");
        const options = {ignoreSearch: true, ignoreVary: true}
        const cachedResponse = await cacheStorage.match(request.url, options);

        if ( ! cachedResponse || ! cachedResponse.ok ) {
            console.log("error getting members from cache");
            return false;
        }
        //return cachedResponse;
        return await cachedResponse.json();
    }
    //If requirement is completed, show a tick
    function completion(done, required) {
        if (done >= required) {
            return '<td class="completed"></td>';
        } else {
            return '<td>'+done+'/'+required+'</td>';
        }
    }

    var milestoneTable = {"1": {"p": 6, "a": 2, "l": 1, "tp": 24},
                          "2": {"p": 5, "a": 3, "l": 2, "tp": 20},
                          "3": {"p": 4, "a": 4, "l": 4, "tp": 16}
                         };

    var achievements = {
        'milestone' : 'Milestone',
        'outdoor_adventure_skill' : 'OAS',
        'special_interest_area' : 'SIA',
        "intro_scouting": "⚜️ Introduction to Scouting",
        "intro_section": "🗣️ Introduction to Section",
        "course_reflection": "📚 Personal Development Course",
        "adventurous_journey": "🚀 Adventurous Journey",
        "personal_reflection": "📐 Personal Reflection",
        "peak_award": "⭐ Peak Award",
        "sia_adventure_sport": "🏈 Adventure & Sport",
        "sia_art_literature": "🎭 Arts & Literature",
        "sia_better_world": "🌏 Creating a Better World",
        "sia_environment": "♻️ Environment",
        "sia_growth_development": "🌱 Growth & Development",
        "sia_stem_innovation": "🔎 STEM & Innovation",
        'bushcraft' : '🏞️ Bushcraft',
        'camping' : '⛺ Camping',
        'bushwalking' : '🥾 Bushwalking',
        'aquatics' : '🏊 Aquatics',
        'vertical' : '🧗 Vertical',
        'alpine' : '❄️ Alpine',
        'paddling' : '🛶 Paddling',
        'boating' : '⛵ Boating',
        'cycling' : '🚲 Cycling',
        '1' : '1',
        '2' : '2',
        '3' : '3'
    }

    function lookupAcheivements(achevement){
        return achievements[achevement];
    }

    async function getMemberAchievements(memberId, current_member, section){
        return new Promise(resolve => {
            var url = achievements_url + '/' + memberId + '/achievements';
            //var achievements =
            getTerrainData(url).then(data=> {
                resolve({current_member, section, data});
            });
        });
    }

    async function leadAssistRequired(ma, section){
        function check_missing_credits(name, milestone, p_total, a_total, l_total, type) {
            var result = '';
            var p_target = milestoneTable[milestone].tp;
            var a_target = milestoneTable[milestone].a;
            var l_target = milestoneTable[milestone].l;
            if (p_total >= p_target) {
                if (type == 'assists') {
                    if (a_total < a_target) {
                        result += name + ' (Milestone ' + milestone + ') needs ' + (a_target-a_total) + ' ' + type + '<br>'
                    }
                }
                if (type == 'leads') {
                    if (l_total < l_target) {
                        result += name + ' (Milestone ' + milestone + ') needs ' + (l_target-l_total) + ' ' + type + '<br>';
                    }
                }
            }
            return result;
        }
        var type = "";
        var current_member = ma.name;
        var member_id = ma.member_id;

        await getMemberAchievements(member_id, current_member, section)
            .then(data => {
            var achievements = data.data.results;
            current_member = data.current_member;
            section = data.section;

            processedMembers += 1;

            if (achievements !== null){
                for(var i = 0; i < achievements.length; i++) {
                    var y = achievements[i];
                    var member_content = '';
                    // status options: awarded, not_required, in_progress, draft_review, feedback_review ..
                    if (y.type=='milestone' && y.milestone_requirement_status=='complete'
                        && (y.status=='in_progress' || y.status=='draft_review' || y.status=='feedback_review')) {
                        type = lookupAcheivements(y.type) + ' ' + lookupAcheivements(y.achievement_meta.stage);
                        member_content += current_member + ' ' + type + ' - Ready for review';

                        if(member_content){
                            recent_updates.push({section: section,
                                                 content: member_content});
                        }
                    }

                    var reportDate = new Date();
                    reportDate.setDate(reportDate.getDate() - 14);
                    reportDate = Date.parse(reportDate);

                    var updatedDate = new Date();
                    updatedDate = Date.parse(y.status_updated);

                    if (y.status=='awarded' && updatedDate > reportDate) {
                        member_content += current_member + ' achieved ';

                        if (y.type=='milestone') {
                            type = lookupAcheivements(y.type) + ' ' + lookupAcheivements(y.achievement_meta.stage);
                            member_content += type;
                        }
                        if (y.type=='special_interest_area') {
                            type = lookupAcheivements(y.type) + ' ' + lookupAcheivements(y.answers.special_interest_area_selection);
                            member_content += type;
                        }
                        if (y.type=='outdoor_adventure_skill') {
                            type = lookupAcheivements(y.type) + ' ' + lookupAcheivements(y.achievement_meta.stream) + ' ' + lookupAcheivements(y.achievement_meta.stage);
                            member_content += type;
                        }

                        if(member_content){
                            recent_updates.push({section: section,
                                                 content: member_content});
                        }
                    }

                    if (y.type=='milestone' && y.milestone_requirement_status == 'incomplete' && y.section == section
                        && (y.status=='in_progress' || y.status=='draft_review')) {
                        var milestone = y.achievement_meta.stage;
                        var p_total = (y.event_count.participant.community +
                                       y.event_count.participant.outdoors +
                                       y.event_count.participant.creative +
                                       y.event_count.participant.personal_growth);
                        var a_total = (y.event_count.assistant.community +
                                       y.event_count.assistant.outdoors +
                                       y.event_count.assistant.creative +
                                       y.event_count.assistant.personal_growth);
                        var l_total = (y.event_count.leader.community +
                                       y.event_count.leader.outdoors +
                                       y.event_count.leader.creative +
                                       y.event_count.leader.personal_growth);

                        participateCount.push({memberId: ma.member_id,
                                               section: section,
                                               milestone: y.achievement_meta.stage,
                                               community: y.event_count.participant.community,
                                               outdoors: y.event_count.participant.outdoors,
                                               creative: y.event_count.participant.creative,
                                               personal_growth: y.event_count.participant.personal_growth});

                        var missingAssists = check_missing_credits(current_member,milestone,p_total,a_total,l_total,'assists');
                        if(missingAssists){
                            assists_content.push({section: section,
                                                  content: missingAssists});
                        }
                        var missingLeads = check_missing_credits(current_member,milestone,p_total,a_total,l_total,'leads');
                        if(missingLeads){
                            leads_content.push({section: section,
                                                content: missingLeads});
                        }
                    }
                }
            } else
            {
                console.log("no achievement info loaded for " + current_member);
            }

            if(processedMembers == totalMembers)
            {
                console.log("all members processed");
                for(var u = 0; u < myProfile.profiles.length; u++) { //For each unit
                    var sec = myProfile.profiles[u].unit.section;
                    renderUpdateContent(sec);
                    renderLeadAssist(sec);
                    renderArcNeeded(sec)
                };
            }
        });
    }

    function milestoneCells(milestones){
        var milestoneHtml = "";
        milestones.sort((a, b) => a.milestone - b.milestone);
        milestones.forEach(function(milestone, m){
            var milestoneNumber = milestone.milestone;
            if(milestone.awared){ milestoneHtml += "<td colspan='7'>Awarded</td>" }
            else{
                var milestoneCellOutput = completion(milestone.participates.find(item => item.challenge_area == "community").total, milestoneTable[milestoneNumber].p) +
                    completion(milestone.participates.find(item => item.challenge_area == "outdoors").total, milestoneTable[milestoneNumber].p) +
                    completion(milestone.participates.find(item => item.challenge_area == "creative").total, milestoneTable[milestoneNumber].p) +
                    completion(milestone.participates.find(item => item.challenge_area == "personal_growth").total, milestoneTable[milestoneNumber].p) +
                    completion(milestone.total_assists,milestoneTable[milestoneNumber].a) +
                    completion(milestone.total_leads,milestoneTable[milestoneNumber].l) +
                    '<td>&nbsp</td>';
                milestoneHtml += milestoneCellOutput;
            }
        });
        for(var i = milestones.length; i < 3; i++){
            milestoneHtml += "<td colspan='7'>Not Started</td>";
        }
        return milestoneHtml;
    }

    function renderUpdateContent(section){
        if (recent_updates){
            var sectionUpdates = recent_updates.filter(function(el) {return el.section == section});

            if(sectionUpdates.length > 0)
            {
                var reportDate = new Date();
                reportDate.setDate(reportDate.getDate() - 14);
                var recentUpdatedReport = '<p><b>Recent Updates</b> (from ' + reportDate.toLocaleDateString('en-GB') +')</p>';

                for(var l = 0; l < sectionUpdates.length; l++){
                    recentUpdatedReport += sectionUpdates[l].content + '<br />';
                }

                renderingContainers.push({
                    type: "memberUpdates",
                    key: 4,
                    location: "column",
                    html: '<div class="Card card mr-auto v-card--shaped card MilestonesParticipates mb-4 v-card v-sheet theme--light">' + recentUpdatedReport +'</div>',
                    section: section,
                    render: true});
            }
        }
    }

    function renderArcNeeded(section){
        var arcNeededReport = "";
        var communityNum = 0, outdoorsNum = 0, creativeNum = 0, personalGrowthNum = 0, totalRecNum = 0;
        var filteredList = participateCount.filter(function(el) {return el.section == section});

        const result = [];
        const map = new Map();
        for (const item of filteredList) {
            if(!map.has(item.memberId)){
                map.set(item.memberId, true); // set any value to Map
                result.push({memberId:  item.memberId,
                             section: item.section,
                             milestone: item.milestone,
                             community: item.community,
                             outdoors: item.outdoors,
                             creative: item.creative,
                             personal_growth: item.personal_growth,
                             milestoneRequirement: milestoneTable[item.milestone].p
                            });

                communityNum = communityNum + parseInt(item.community);
                outdoorsNum = outdoorsNum + parseInt(item.outdoors);
                creativeNum = creativeNum + parseInt(item.creative);
                personalGrowthNum = personalGrowthNum + parseInt(item.personal_growth);
                totalRecNum = totalRecNum + parseInt(milestoneTable[item.milestone].p);
            }
        }

        arcNeededReport = "<b>ARC Credits needed</b> Credits per Challenge Area for member to reach next milestone</br>";
        arcNeededReport += "<b>Community:</b> " + communityNum + " of " + totalRecNum + "("
            + Math.round((communityNum/totalRecNum)*100) + "%) required </br>";
        arcNeededReport += "<b>Outdoors:</b> " + outdoorsNum + " of " + totalRecNum + "("
            + Math.round((outdoorsNum/totalRecNum)*100) + "%) required</br>";
        arcNeededReport += "<b>Creative:</b> " + creativeNum + " of " + totalRecNum + "("
            + Math.round((creativeNum/totalRecNum)*100) + "%) required</br>";
        arcNeededReport += "<b>Personal Growth:</b> " + personalGrowthNum + " of " + totalRecNum + "("
            + Math.round((personalGrowthNum/totalRecNum)*100) + "%) required";

        renderingContainers.push({
            type: "ArcNeeded",
            key: 4,
            location: "column",
            html: '<div class="Card card mr-auto v-card--shaped card MilestonesParticipates mb-4 v-card v-sheet theme--light">' + arcNeededReport + '</div>',
            section: section,
            render: true});
    }

    function renderLeadAssist(section){
        var leadAssistReport = "<p><b>Members needing leadership credits</b> (participation target has been met)</p>";

        if (assists_content || leads_content){
            //Filter for the section
            var assists = assists_content.filter(function(el) {return el.section == section});
            var leads = leads_content.filter(function(el) {return el.section == section});

            if (assists.length > 0 || leads.length > 0){
                var actionRequiredContent = "";

                if (assists.length > 0){
                    leadAssistReport += '<i>Assists</i><br>';
                    for(var a = 0; a < assists.length; a++){
                        leadAssistReport += assists[a].content;
                    }
                }
                if (leads.length > 0){
                    leadAssistReport += '<i>Leads</i><br>';
                    for(var l = 0; l < leads.length; l++){
                        leadAssistReport += leads[l].content;
                    }
                }
            }else{
                leadAssistReport += "<i>No lead/assists required at this stage!</i>";
            }

            renderingContainers.push({
                type: "LeadAssist",
                key: 2,
                location: "column",
                html: '<div class="Card card mr-auto v-card--shaped card MilestonesParticipates mb-4 v-card v-sheet theme--light">' + leadAssistReport + '</div>',
                section: section,
                render: true});
        }
    }

    async function renderApprovalsRequired(unitId, section){
        var url = agenda_url + "/" + unitId + "/member-agenda";
        await getTerrainData(url).then(data => {
            var approvalContent = "";
            for(var a = 0; a < data.items.length; a++){
                var approval = data.items[a];
                approvalContent += approval.title + " <br />";
            }
            if(data.items.length>0){
                approvalContent = "<div><p><b>Pending approvals</b></p>" + approvalContent + "</div>";
                renderingContainers.push({
                    type:"approvalRequired",
                    key: 1,
                    location: "column",
                    html: '<div class="Card card mr-auto v-card--shaped card MilestonesParticipates mb-4 v-card v-sheet theme--light">' + approvalContent + '</div>',
                    section: section,
                    render: true});
            }else{
                renderingContainers.push({
                    type:"approvalRequired",
                    section: section,
                    render: false});
            }
        });
    }

    function renderUnitTable(myUnit, unitName, section) {
        function oas(oas, output = "html") {
            var oaslist = {"camping":"-", "bushcraft": "-" ,"bushwalking": "-","alpine":"-","cycling":"-","vertical":"-","aquatics":"-","boating":"-","paddling":"-"};
            var oasbranches = {"pioneering":"-","survival-skills":"-","cross-country-skiing":"-","snow-camping-and-hiking":"-","downhill-skiing":"-","snowboarding":"-","cycle-touring":"-","mountain-biking":"-","abseiling":"-","canyoning":"-","caving":"-","climbing":"-"};
            for (var i = 0; i < oas.highest.length; i++) {
                //eg. stream: "bushcraft" & branch: survival-skills
                if (oaslist[oas.highest[i].stream] == "-" || oas.highest[i].stage > oaslist[oas.highest[i].stream]) {
                    oaslist[oas.highest[i].stream] = oas.highest[i].stage;
                }
                if (csvbranch && oas.highest[i].stream != oas.highest[i].branch) {
                    try {
                        oasbranches[oas.highest[i].branch] = oas.highest[i].stage;
                    } catch {
                        console.log("error on " + oas.highest[i].branch );
                    }
                }
            }
            oas.list = oaslist;
            oas.branches = oasbranches;
            if (output=="html") {
                return '<td class="core" style="color: var(--color-oas-stage-'+oas.list.camping+');">'+oas.list.camping+
                    '</td><td class="core" style="color: var(--color-oas-stage-'+oas.list.camping+');">'+oas.list.bushcraft+
                    '</td><td class="core" style="color: var(--color-oas-stage-'+oas.list.camping+');">'+oas.list.bushwalking+
                    '</td><td style="color: var(--color-oas-stage-'+oas.list.alpine+');">'+oas.list.alpine+
                    '</td><td style="color: var(--color-oas-stage-'+oas.list.cycling+');">'+oas.list.cycling+
                    '</td><td style="color: var(--color-oas-stage-'+oas.list.vertical+');">'+oas.list.vertical+
                    '</td><td class="water" style="color: var(--color-oas-stage-'+oas.list.aquatics+');">'+oas.list.aquatics+
                    '</td><td class="water" style="color: var(--color-oas-stage-'+oas.list.boating+');">'+oas.list.boating+
                    '</td><td class="water" style="color: var(--color-oas-stage-'+oas.list.paddling+');">'+oas.list.paddling+'</td>';
            } else if (output=="csv") {
                var branches = "";
                if (csvbranch) { branches = ','+oas.branches["pioneering"]+','+oas.branches["survival-skills"]+','+oas.branches["cross-country-skiing"]+','+
                    oas.branches["snow-camping-and-hiking"]+','+oas.branches["downhill-skiing"]+','+oas.branches["snowboarding"]+','+oas.branches["cycle-touring"]+','+
                    oas.branches["mountain-biking"]+','+oas.branches["abseiling"]+','+oas.branches["canyoning"]+','+oas.branches["caving"]+','+oas.branches["climbing"];}
                return oas.list.camping+','+oas.list.bushcraft+','+oas.list.bushwalking+','+oas.list.alpine+','+oas.list.cycling+','+oas.list.vertical+','+oas.list.aquatics+','+oas.list.boating+','+oas.list.paddling+branches;
            } else {return "error";}
        }
        function milestones(m) {
            var mlist = {"m1":"","m2":"","m3":""}
            for (var i = 0; i< m.length; i++) {
                mlist["m"+m[i].milestone] = (m[i].awarded == true ? "completed" : "inprogress")
            }
            return mlist;
        }
        // Compare Ages of scouts. Oldest will appear at the top
        function compareAge( a, b ) {
            if (a.y === undefined) {
                var myRe = /(\d+)y (\d+)m/g;
                var ra = myRe.exec(a.age);
                a.y = ra[1];
                a.m = ra[2];
            }
            if (b.y === undefined) {
                myRe = /(\d+)y (\d+)m/g;
                var rb = myRe.exec(b.age);
                b.y = rb[1];
                b.m = rb[2];
            }
            a.y = parseInt(a.y);
            b.y = parseInt(b.y);
            a.m = parseInt(a.m);
            b.m = parseInt(b.m);

            if ( a.y < b.y ){
                return 1;
            }
            if ( a.y > b.y ){
                return -1;
            }
            if ( a.m < b.m ){
                return 1;
            }
            if ( a.m > b.m ){
                return -1;
            }
            return 0;
        }

        var out = '<div class="v-data-table__wrapper"><table class="reports"><thead class="v-data-table-header">' +
            '<tr style="background-color:#f4f4f4;" valign="bottom"><th colspan="8">Youth Details</th><th>&nbsp;</th><th colspan="7">Milestone 1</th><th colspan="7">Milestone 2</th><th colspan="7">Milestone 3</th><th>&nbsp;</th><th colspan="9">Outdoor Adventure&nbsp;Skills</th></tr>' +
            '<tr style="background-color:#ffffff;"><th scope="col" class="UnitsMetricsTable__header text-start" style="vertical-align:bottom; width: 180px; min-width: 180px;"><div class="d-flex align-center"><span style="white-space: initial;">Unit member</span></div></th>'+
            '<th class="rotate"><div><span>Age</span></div></th><th class="rotate"><div><span>Scouts</span></div></th><th class="rotate"><div><span>Section</span></div></th>'+
            '<th class="rotate"><div><span>Milestone 1</span></div></th><th class="rotate"><div><span>Milestone 2</span></div></th><th class="rotate"><div><span>Milestone 3</span></div></th>'+
            '<th class="rotate"><div><span>Current</div></span></th>' +
            '<th class="rotate">&nbsp</th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/community--default.--cc91206.svg" alt="Community Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/outdoors--default.--d113c08.svg" alt="Outdoor Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/creative--default.--fe2ed67.svg" alt="Creative Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/personal-growth--default.--98a0e95.svg" alt="Personal Growth Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th class="rotate"><div><span>Assist</span></div></th><th class="rotate"><div><span>Lead</span></div></th><th class="rotate">&nbsp</th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/community--default.--cc91206.svg" alt="Community Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/outdoors--default.--d113c08.svg" alt="Outdoor Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/creative--default.--fe2ed67.svg" alt="Creative Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/personal-growth--default.--98a0e95.svg" alt="Personal Growth Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th class="rotate"><div><span>Assist</span></div></th><th class="rotate"><div><span>Lead</span></div></th><th class="rotate">&nbsp</th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/community--default.--cc91206.svg" alt="Community Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>'+
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/outdoors--default.--d113c08.svg" alt="Outdoor Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/creative--default.--fe2ed67.svg" alt="Creative Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th valign="bottom"><div><span><img data-v-3cfe9620="" src="/_nuxt/img/personal-growth--default.--98a0e95.svg" alt="Personal Growth Challenge" class="MilestonesParticipates__pal-icon align-center"></span></div></th>' +
            '<th class="rotate"><div><span>Assist</span></div></th><th class="rotate"><div><span>Lead</span></div></th><th class="rotate">&nbsp</th>'+
            '<th class="rotate">&nbsp;</th>' +
            '<th class="rotate"><div><span>Camping</span></div></th><th class="rotate"><div><span>Bushcraft</span></div></th><th class="rotate"><div><span>Bushwalking</span></div></th>' +
            '<th class="rotate"><div><span>Alpine</span></div></th><th class="rotate"><div><span>Cycling</span></div></th><th class="rotate"><div><span>Vertical</span></div></th>' +
            '<th class="rotate"><div><span>Aquatics</span></div></th><th class="rotate"><div><span>Boating</span></div></th><th class="rotate"><div><span>Paddling</span></div></th></tr></tr>' +
            '</thead>';
        var csvout = "";
        if (csv) {
            csvout = "data:text/csv;charset=utf-8, Unit member,Age,Intro Scouts,Section,Milestone 1,Milestone 2,Milestone 3,Current,Community,Outdoors,Creative,Personal Growth,Assist,Lead,Camping,Bushcraft,Bushwalking,Alpine,Cycling,Vertical,Aquatics,Boating,Paddling";
            if (csvbranch) { csvout += ",pioneering,survival-skills,cross-country-skiing,snow-camping-and-hiking,downhill-skiing,snowboarding,cycle-touring,mountain-biking,abseiling,canyoning,caving,climbing";}
            csvout += "\r\n"
        }
        var i;
        myUnit.results.sort(compareAge);
        totalMembers += myUnit.results.length;

        for(i = 0; i < myUnit.results.length; i++) { //For each scout
            var me = myUnit.results[i];
            var into_scouts = "";
            var into_section = "";
            var m = milestones(me.milestones);
            leadAssistRequired(me, section);

            if (me.intro_to_scouts != null) {into_scouts = "completed";}
            if (me.intro_to_section != null) {into_section = "completed";}
            for (var j = 0; j < me.milestone.participates.length; j++) {
                var ca = me.milestone.participates[j].challenge_area
                me[ca] = completion(me.milestone.participates[j].total,milestoneTable[me.milestone.milestone].participate);
                if (csv) {
                    me[ca+"_csv"] = me.milestone.participates[j].total + " of " + milestoneTable[me.milestone.milestone].participate;
                }
            }

            out += '<tr><td>' + me.name + '</td>'+
                '<td>' + me.y + '</td>'+
                '<td class="' + into_scouts + '"></td>'+
                '<td class="' + into_section + '"></td>'+
                '<td class="' + m.m1 + '"></td>' +
                '<td class="' + m.m2 + '"></td>' +
                '<td class="' + m.m3 + '"></td>' +
                '<td>'+me.milestone.milestone+'</td>' +
                '<td class="divider">&nbsp;</td>' +
                milestoneCells(me.milestones) +
                '<td class="divider">&nbsp</td>' +
                oas(me.oas) +
                '</tr>';

            if (csv) {csvout += me.name + ',' + me.y + ',' + into_scouts + ',' + into_section + ',' + m.m1 + ',' + m.m2 + ',' + m.m3 +
                ','+me.milestone.milestone+','+me.community_csv +','+me.outdoors_csv +','+me.creative_csv +','+me.personal_growth_csv+','+
                me.milestone.total_assists+' of '+milestoneTable[me.milestone.milestone].assist+','+me.milestone.total_leads+' of '+
                milestoneTable[me.milestone.milestone].lead+','+oas(me.oas,"csv")+'\r\n';}
        }
        //Output Table
        out = out + "</table></div>";
        return out

        if (debug) {
            //Updated debug to output all members
            out = "<br>Debug:<br /><pre>"
            for (i = 0; i < myUnit.results.length; i++) {
                myUnit.results[i].member_id = "*****"
                var myRe = /(.*) (\w).*/g;
                var ra = myRe.exec(myUnit.results[i].name);
                myUnit.results[i].name = ra[1]+' '+ra[2];
                out += JSON.stringify(myUnit.results[i]) + "\n"
            }
            out += "</pre>";
            return out;
        }
    }
}
)();


