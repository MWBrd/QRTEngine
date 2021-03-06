<script>
    /* ==========================================================
     * QRTEngine.js v16
     * ==========================================================
     * Copyright 2013-2014 Erwin Haasnoot
     *
     * Licensed under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License.
     * You may obtain a copy of the License at
     *
     * http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software
     * distributed under the License is distributed on an "AS IS" BASIS,
     * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
     * See the License for the specific language governing permissions and
     * limitations under the License.
     *
     *
     *
     * ========================================================== */
    /**
     * Qualtrics Reaction Time Engine or QRTE is an add-on providing an interface
     * for easy reaction time experiment creation in the Qualtrics survey research suite (tm).
     * For instructions on how to use this add-on, see xxxx
     *
     * QRTE was developed by Erwin Haasnoot
     * Email: erwinhaasnoot[at]gmail.com
     * @class QRTE
     *
     */
    var QRTE = {
        version: 'v16',
        columnsField: 'QRTE_columns',
        blockDataField: 'QRTE_blockData',
        idField: 'QRTE_idData',
        exitQuestions: 'QRTE_exitQuestions',
        inited: false,
        /**
         * TDCache contains the Trial-Level Data in an Object. DO NOT directly manipulate this Object. It might cause inconsistencies in the data file and cause unexpected once parsed.
         * Use QRTE.setTrialData and QRTE.getTrialData instead.
         *
         * @property TDCache
         * @private
         * @type Object
         */
        TDCache: {},

        /**
         * ColumnCache contains all the mappings from QID to Columns
         * @property columnCache
         * @private
         * @type Object
         */
        columnCache: {},

        /**
         * BDCache contains the BlockLevel Data in an Object. Directly manipulating this Object might cause inconsistencies
         * @property BDCache
         * @private
         * @type Object
         */
        BDCache: {},

        /**
         * SDCache is a cache for speeding up retrieval of Survey level Data,
         * All Survey data is saved to both Embedded Data and Survey Data
         * @private
         * @property SDCache
         * @type Object
         */
        SDCache: {},

        /**
         * idCache is a cache for quickly retrieving the Qualtrics QID to QRTLib Id mappings.
         * Saved in the idData embedded data field after every trial.
         * @private
         * @property idCache
         * @type Object
         */
        idCache: {},

        /**
         * questionQueue contains Objects (stimuli) that are waiting to be presented
         * @private
         * @property questionQueue
         * @type Array
         */
        questionQueue: [],

        /**
         * currentPageQuestions contains the Question Objects that are
         * displayed at any given time.
         * @private
         * @property currentPageQuestions
         * @type Array
         */
        currentPageQuestions: [],

        /**
         * Contains Trial Data Columns that were 'newly' added in this trial run.
         * @private
         * @property newlyAddedColumns
         * @type Array
         */
        newlyAddedColumns: [],

        /**
         * Contains the Post-Initialization Element.
         * @private
         * @property postInitElement
         * @type Object
         */
        postInitElement: {},

        /**
         * Setter function for Trial-Level Data.
         * @method setTrialData
         * @param key {String} Key
         * @param value {Value} Value
         */
        setTrialData: function(key, value) {
            //Store value in trial cache
            this.TDCache[key] = value;
            if (this.BDCache.QRTLib_trialColumns[key] === undefined) {
                //Add column to overall trial data
                this.BDCache.QRTLib_trialColumns[key] = '';
                this.newlyAddedColumns.push(key);
            }
        },

        /**
         * Gets the value of Trial-Level Data field 'key
         * @method getTrialData
         * @param key {String} Key
         */
        getTrialData: function(key) {
            return this.TDCache[key];
        },

        /**
         * Setter function for Block-Level Data.
         * @method setBlockData
         * @param key {String} Key
         * @param value {Value} Value
         */
        setBlockData: function(key, value) {
            this.BDCache[key] = value;
        },


        /**
         * Gets the value of Block-Level Data field 'key
         * @method getBlockData
         * @param key {String} Key
         */
        getBlockData: function(key) {
            return this.BDCache[key];
        },




        /**
         * Stringify the Block Data and store it in the Embedded Data Field. This preserves the values stored on Block Level for use in later trials
         * @method saveBlockData
         * @param key {String} Key
         */
        saveBlockData: function() {
            //Store blockData in ED so that we can use it next trial
            QRTEController.storeBlockData(QRTE.BDCache);
            Qualtrics.SurveyEngine.setEmbeddedData(QRTE.blockDataField, Object.toJSON(QRTE.BDCache));
        },



        /**
         * Setter function for Survey-Level Data (Embedded Data).
         * @method setSurveyData
         * @param key {String} Key
         * @param value {Value} Value
         */
        setSurveyData: function(key, value) {
            this.SDCache[key] = value;
            Qualtrics.SurveyEngine.setEmbeddedData(key, value);
        },



        /**
         * Gets the value of Survey-Level Data (Embedded Data) 'key'
         * @method getSurveyData
         * @param key {String} Key
         */

        getSurveyData: function(key) {
            if (this.SDCache[key] !== undefined) {
                return this.SDCache[key];
            }
            //This only works if the Survey Data has been set during the same trial due to a bug in Qualtrics.
            return Qualtrics.SurveyEngine.getEmbeddedData(key);
        },

        /**
         * Sets a configuration for a question
         * @method setConfig
         * @param QID {String} The QRTE Question Id of the Question you want the configuration to apply to
         * @param option {String} The type of configuration you want to set, Allowed options: 'cresp', 'allowable', 'duration', 'endaction', 'delay'. Refer to website for documentation on these configs
         * @param value {String} The value the configuration needs to be set to. Differs per option.
         */
        setConfig: function(QID, option, value) {
            var setterFunc;
            if (typeof QID === 'string') {
                setterFunc = function(QID, option, value) {
                    this.setTrialData(QID + "[" + option + "]", value);
                };
            } else {
                setterFunc = function(QID, option, value) {
                    this.setTrialData(QID.questionId + "[" + option + "]", value);
                    QID['_' + option] = value;
                };

            }

            this._setConfig(QID, option, value, setterFunc);
        },


        /**
         * Loads the configuration for a question.
         * @private
         * @method loadConfig
         * @param question {Object} Question for which the configuration needs to be loaded.
         */
        loadConfig: function(question) {
            if (this.idCache[question.questionId] !== undefined) {
                question.QRTLib_configId = this.idCache[question.questionId];
            } else {
                question.QRTLib_configId = question.question;
            }
            question.duration = this.getDuration(question);
            question.allowable = this.getAllowable(question);
            question.cresp = this.getCResp(question);
            question.offset = this.getOffset(question);
            question.endAction = this.getEndAction(question);
        },

        /**
         * Stores the accuracy of a trial
         * @private
         * @method saveAcc
         * @param question {Object} Question for which accuracy needs to be stored
         * @param acc {Integer} Accuracy of question
         */

        saveAcc: function(question, acc) {
            if (acc === 0 || acc === 1) {
                this.setTrialData(question.QRTLibId + "[ACC]", acc);
                this.setSurveyData("ACC", acc);
            }
        },



        /**
         * Check whether the given response was a correct response
         * @method isCorrectResponse
         * @param question {Object} Question for which correct response needs to be checked
         * @param resp {String} Given response
         */
        isCorrectResponse: function(question, resp) {
            return question.cresp.indexOf(resp) >= 0;
        },

        /**
         * Check whether the given response was an allowable response
         * @method isAllowableResponse
         * @param question {Object} Question for which allowable response needs to be checked
         * @param resp {String} Given response
         */
        isAllowableResponse: function(question, resp) {
            return question.allowable.indexOf(resp) >= 0;
        },



        /**
         * Check whether the given response was an allowable response
         * @private
         * @method keycode2string
         * @param e {Object} KeyPress event from which to retrieve the response
         */
        keycode2string: function(e) {
            return String.fromCharCode(e.charCode);
        },

        /** 
         * Wait for images to load before starting trial.
         * @property waitForImageLoad
         * @private
         * @type Boolean
         */

        waitForImageLoad: true,

        /** 
         * Trial Start waiting list - initialised with waiting for TrialStart
         * @property loadWaitingList
         * @private
         * @type Array
         */

        loadWaitingList: [false],

        /**
         * Initializes the Engine, called at the start of the 'Init' question.
         * @private
         * @method initLib
         * @param blockDataString {String} JSON string containing information saved for this block (block-level data)
         * @param blockId {String} Id of the current block
         * @param columns {String} JSON string containing information about the columns that have been defined in this block
         * @param idData {String} JSON string containing information about the mapping of the QID to the name of the question
         * @param exitQuestions {String} String containing the currently defined QuestionTags of the Exit questions
         * @param exitItemTag {String} String containing the Tag of this block's Exit question.
         */


        initLib: function(blockDataString, blockId, columns, idData, exitQuestions, exitItemTag) {
            //var blockDataString = Qualtrics.SurveyEngine.getEmbeddedData(QRTE.blockDataField),
            //columns = Qualtrics.SurveyEngine.getEmbeddedData(QRTE.columnsField),
            //idData = Qualtrics.SurveyEngine.getEmbeddedData(QRTE.idField);
            var glue;
            QRTE.fixSetEmbeddedDataBug();
            //Initialise block Data
            if (blockDataString === undefined || blockDataString === '') {
                blockDataString = '{}';
                Qualtrics.SurveyEngine.setEmbeddedData(QRTE.blockDataField, blockDataString);
            }

            this.BDCache = QRTEController.loadBlockData(blockDataString);

            if (this.BDCache.QRTLib_currentBlock !== blockId) {
                //If this is a new block, initialise a new block
                this.BDCache = {
                    QRTLib_currentBlock: blockId,
                    QRTLib_blockCounter: 1,
                    QRTLib_trialColumns: {}
                };
                Qualtrics.SurveyEngine.setEmbeddedData(QRTE.blockDataField, Object.toJSON(this.BDCache));

                glue = '';
                if (exitQuestions !== '') {
                    glue = ';';
                }
                //And update the exit questions
                Qualtrics.SurveyEngine.setEmbeddedData(QRTE.exitQuestions, exitQuestions + glue + exitItemTag);

            }
            QRTE.TDCache = Object.toJSON(QRTE.getBlockData('QRTLib_trialColumns')).evalJSON();
            if (columns === undefined || columns === '') {
                columns = '{}';
                Qualtrics.SurveyEngine.setEmbeddedData(QRTE.columnsField, columns);
            }
            QRTE.SDCache[QRTE.columnsField] = columns.evalJSON();
            if (idData === undefined || idData === '') {
                idData = '{}';
                Qualtrics.SurveyEngine.setEmbeddedData(QRTE.idField, idData);
            }
            QRTE.idCache = idData.evalJSON();
        },

        /**
         * Init initializes the QRTEngine, expects are params object with possible fields defined with parameters.
         * @method Init
         * @param paramObj {Object} object containing parameters of Init function
         *  @param paramObj.blockData {String} blockData string in json format (from embedded data)
         *  @param paramObj.columnData {String} columnData string in json format (from embedded data)
         *  @param paramObj.exitQuestions {String} exitQuestions string (from embedded data)
         *  @param paramObj.exitItemTag {String} Tag of the Exit question of this block
         *  @param paramObj.blockId {String} Identificaton of the block
         *  @param [paramObj.onLoadFn] {Function} Function to be called when this Question is displayed
         *  @param [paramObj.interTrialDelay] {Integer|Array} Specify millisecond delay between end of previous trial and beginning of new trial
         *  @param [paramObj.preTrialDelay] {Integer|Array} Specify millisecond (ms) delay before the start of the first trial of the block. //NYI
         *  @param [paramObj.initQuestionIndex] {Integer} Specify index of the Init question in the Question Block (defaults to 1)
         *  @param [paramObj.waitForImages] {Boolean} Specify whether we should wait for images or not. Is on by default, but could be turned off if all images are pre-loaded in cache, or are very small in general.
         */
        Init: function(paramObj) {
            var validationArray, qArray, initIndex;
            //init the library
            QRTE.init();

            //set the initIndex (if the Init question is not the first question of the block)
            QRTE.initIndex = paramObj.initQuestionIndex - 1 || 0;


            validationArray = [{
                name: 'blockData',
                type: ['JSON', 'Empty'],
                required: true
            }, {
                name: 'columnData',
                type: ['JSON', 'Empty'],
                required: true
            }, {
                name: 'idData',
                type: ['JSON', 'Empty'],
                required: true
            }, {
                name: 'blockId',
                type: ['String'],
                required: true
            }, {
                name: 'onLoadFn',
                type: ['Function'],
                required: false
            }, {
                name: 'interTrialDelay',
                type: ['Integer', 'Array'],
                required: false
            }, {
                name: 'exitQuestions',
                type: ['String'],
                required: true
            }, {
                name: 'exitItemTag',
                type: ['String'],
                required: true
            }, {
                name: 'waitForImages',
                type: ['Boolean'],
                required: false
            }];

            //Validate Parameter Object, outputs stuff to console
            QRTE.validateParams(paramObj, validationArray, 'Init');


            //Initialize the library itself (necessary for each trial)
            QRTE.initLib(paramObj.blockData, paramObj.blockId, paramObj.columnData, paramObj.idData, paramObj.exitQuestions, paramObj.exitItemTag);


            if (paramObj.waitForImages !== undefined) {
                QRTE.waitForImageLoad = paramObj.waitForImages;
            }
            //calculate server communication delay
            QRTE.setTrialData('InitPre[OnsetTime]', QRTE.getBlockData('QRTLib_previousStorageDone'));

            QRTE.setTrialData('InitPre[OffsetTime]', window.requestAnimationFrame.now());
            QRTE.setTrialData('InitPre[CalculatedDuration]', QRTE.getTrialData('InitPre[OffsetTime]') - QRTE.getTrialData('InitPre[OnsetTime]'));
            QRTE.setTrialData('Init[OnsetTime]', window.requestAnimationFrame.now());



            Qualtrics.SurveyEngine.addOnload(function() {
                this.qHTML = document.getElementById(this.questionId);
                this.QRTLib_isActive = false;
                this.hideChoices();
                this.proceed = QRTE.proceed;
                this.QRTLibId = 'InitPost';

                paramObj.onLoadFn.apply(this);
                var QuestionStackElement = {
                    questionElement: this,
                    onShowFunc: function() {},
                    type: 'Stimulus',
                    loadConfig: true,
                    id: 'InitPost',
                    conditional: function() {
                        return true;
                    },
                    proceedOnHide: true

                };
                QRTE.setConfig(QuestionStackElement.id, 'duration', 0);
                QRTE.postInitElement = QuestionStackElement;
                QRTE.questionQueue.push(QuestionStackElement);
            });

            if (paramObj.interTrialDelay instanceof Array) {
                paramObj.interTrialDelay = paramObj.interTrialDelay[Math.floor(Math.random() * paramObj.interTrialDelay.length)];
            }
            QRTE.setTrialData(paramObj.blockId + '[InterTrialDelay]', paramObj.interTrialDelay);
            if (paramObj.interTrialDelay > 0) {
                QRTE.setBlockData('QRTLib_intraTrialDelay', paramObj.interTrialDelay);
            } else {
                QRTE.setBlockData('QRTLib_intraTrialDelay', -1);
            }
        },

        /**
         * Create a Stimulus question
         * @method Stimulus
         * @param paramObj {Object}
         *  @param paramObj.id {String} Id of the Question
         *  @param paramObj.onShowFn {Function} Function to be called upon showing the question (not the same as upon loading)
         *  @param [paramObj.conditional] {Function} Function to be called with which to decide whether to present this question or not, should return a boolean.
         *  @param [paramObj.loadConfig] {Boolean} Load predefined config for this question (defaults to true)
         *  @param [paramObj.stimContinue] {Boolean} Continue looking for stimuli after having seen this one, only if set to true (defaults to false)
         *  @param [paramObj.onKeyPress] {Function} Function to be called upon receiving a key press while this Question is active (called next to onAllowableKey or onCorrectKey)
         *  @param [paramObj.onAllowableKey] {Function} Function to be called upon receiving a key press on a key defined as 'allowable' 
         *  @param [paramObj.onCorrectKey] {Function} Function to be called upon receiving a key press on a key defined as 'correct'
         *  @param [paramObj.onIncorrectKey] {Function} Function to be called upon receiving an allowable key that is not defined as correct (only if correct responses are defined)
         *  @param [paramObj.proceedOnHide] {Boolean} Set whether all currently displayed elements should be removed on hide, or if only this should be removed from display (Defaults to True). This allows the user to decouple presentation of a stimulus from proceeding of a slide.
         *  @param [paramObj.onHideFn] {Function} Function to be called upon Stimulus being hidden
         *  @param [paramObj.duringDisplayFn] {Function} Function to be called during each frame that the Stimulus is being displayed
         
         */
        Stimulus: function(paramObj) {
            var validationArray = [{
                name: 'id',
                type: ['String'],
                required: true
            }, {
                name: 'onShowFn',
                type: ['Function'],
                required: true
            }, {
                name: 'conditional',
                type: ['Function'],
                required: false
            }, {
                name: 'loadConfig',
                type: ['Boolean'],
                required: false
            }, {
                name: 'duringDisplayFn',
                type: ['Function'],
                required: false
            }, {
                name: 'continue',
                type: ['Boolean'],
                required: false
            }, {
                name: 'onAllowableKey',
                type: ['Function'],
                required: false
            }, {
                name: 'onCorrectKey',
                type: ['Function'],
                required: false
            }, {
                name: 'onKeyPress',
                type: ['Function'],
                required: false
            }, {
                name: 'onIncorrectKey',
                type: ['Function'],
                required: false
            }, {
                name: 'proceedOnHide',
                type: ['Boolean'],
                required: false
            }, {
                name: 'onHideFn',
                type: ['Function'],
                required: false
            }];

            //Validate Parameter Object, outputs stuff to console
            QRTE.validateParams(paramObj, validationArray, 'Stimulus');


            if (paramObj.conditional === undefined) {
                paramObj.conditional = function() {
                    return true;
                };
            }
            if (paramObj.loadConfig === undefined) {
                paramObj.loadConfig = true;
            }

            if (paramObj.stimContinue === undefined) {
                paramObj.stimContinue = false;
            }

            if (paramObj.proceedOnHide === undefined) {
                paramObj.proceedOnHide = true;
            }
            Qualtrics.SurveyEngine.addOnload(function() {
                this.QRTLib_isActive = false;
                this.proceed = QRTE.proceed;
                this.QRTLibId = paramObj.id;
                var QuestionStackElement = {
                    questionElement: this,
                    onShowFunc: paramObj.onShowFn,
                    duringDisplayFn: paramObj.duringDisplayFn,
                    onHideFn: paramObj.onHideFn,
                    type: 'Stimulus',
                    loadConfig: paramObj.loadConfig,
                    id: paramObj.id,
                    conditional: paramObj.conditional,
                    stimContinue: paramObj.stimContinue,
                    onAllowableKey: paramObj.onAllowableKey,
                    onCorrectKey: paramObj.onCorrectKey,
                    onKeyPress: paramObj.onKeyPress,
                    onIncorrectKey: paramObj.onIncorrectKey,
                    proceedOnHide: paramObj.proceedOnHide
                };
                QRTE.questionQueue.push(QuestionStackElement);
            });
        },

        /**
         * Exit denotes the end of the block. Important for the initialization phase and the exit phase.
         * Make the question a Form question with precisely 2 answer fields (more is unnecessary, those will get ignored)
         * @method Exit
         */
        Exit: function() {


            qArray = $('Questions').getElementsByClassName('QuestionOuter');
            for (var i = 0; i < qArray.length && i < QRTE.initIndex + 1; i += 1) {
                qArray[i].style.display = 'block';
            }
            Qualtrics.SurveyEngine.addOnload(function() {
                //Hide all choice
                this.hideChoices();
                //display the question
                //this.questionContainer.style.display = 'none';
                var QuestionStackElement, onShowFn;
                onShowFn = function() {

                    //Create and/or store standard information about the trial
                    var blockId = QRTE.getBlockData('QRTLib_currentBlock'),
                        tempTD = {},
                        key,
                        i;

                    QRTE.setBlockData('QRTLib_previousEndTime', window.requestAnimationFrame.now());
                    QRTE.setTrialData(blockId + '[TrialNr]', QRTE.getBlockData('QRTLib_blockCounter'));
                    QRTE.setTrialData(blockId + '[RefreshPeriod]', QRTE.refreshPeriod);
                    QRTE.setTrialData('BlockId', blockId);
                    QRTE.setTrialData('EngineType', window.requestAnimationFrame.method);
                    QRTE.setTrialData('Exit[OnsetTime]', window.requestAnimationFrame.now());
                    QRTE.setTrialData('QRTEngine[Version]', QRTE.version);

                    //CHECK IF ATLEAST TWO FORM FIELDS HAVE BEEN DEFINED
                    this.setChoiceValue(2, 'testtest');
                    if (this.getChoiceValue(2) !== 'testtest') {
                        alert('You need to define two answer form fields in the Exit question!!');
                    }

                    for (key in QRTE.TDCache) {
                        if (QRTE.TDCache.hasOwnProperty(key) && key !== '') {
                            //Change QID thingies to entered ID's, also force every value to a string so that the Parser handles high numerical values correctly
                            tempTD[QRTE.getOutputKey(key)] = String(QRTE.TDCache[key]);
                        }
                    }

                    this.setChoiceValue(1, Object.toJSON(tempTD));
                    this.setChoiceValue(2, blockId);
                    if (QRTE.SDCache[QRTE.columnsField][blockId] === undefined) {
                        QRTE.SDCache[QRTE.columnsField][blockId] = [];
                    }
                    for (i = 0; i < QRTE.newlyAddedColumns.length; i += 1) {
                        QRTE.SDCache[QRTE.columnsField][blockId].push(QRTE.getOutputKey(QRTE.newlyAddedColumns[i]));
                    }

                    QRTE.setSurveyData(QRTE.columnsField, Object.toJSON(QRTE.SDCache[QRTE.columnsField]));
                    QRTE.setBlockData('QRTLib_blockCounter', QRTE.getBlockData('QRTLib_blockCounter') + 1);
                    QRTE.setBlockData('QRTLib_previousStorageDone', window.requestAnimationFrame.now());
                    QRTE.saveBlockData();

                    //If wanting to test, uncomment this line and comment the one after that to enforce manual nextbutton clicks
                    //$('NextButton').style.display = 'block';
                    //QRTE.submitPage();
                    QRTEController.loadNextTrial();
                };

                QuestionStackElement = {
                    questionElement: this,
                    onShowFunc: onShowFn,
                    type: 'Storage',
                    loadConfig: true,
                    conditional: function() {
                        return true;
                    }
                };
                QRTE.questionQueue.push(QuestionStackElement);

                QRTE.startTrial(0);

            });

            QRTE.loadWaitingList = [false];
            if (QRTE.waitForImageLoad === true) {
                //set wait for image load queues.
                var loadIndex = 1,
                    images = $$('.QuestionOuter img'),
                    i = 0;

                var l = images.length;
                for (; i < l; i += 1) {
                    images[i].observe('load', function(e) {
                        QRTE.startTrial(e.path[0].QRTELoadIndex);
                    })
                    images[i].QRTELoadIndex = i + 1;
                    QRTE.loadWaitingList[i + 1] = false;
                }

            }

        },

        /**
         * Remove the padding Qualtrics adds between Questions (causes question presentation to drift downwards if not called).
         * DEPRECATED: Separators hidden through CSS now
         * @method removeSeparators
         * @private
         */
        removeSeparators: function() {
            var questionElement = document.getElementById('Questions'),
                index;
            for (index = 0; index < questionElement.children.length; index += 1) {
                if (questionElement.children[index].className === "Separator") {
                    questionElement.children[index].parentNode.removeChild(questionElement.children[index]);
                }
            }
        },
        /**
         * Notifies the engine the first trial is ready to be started. Called at the end of the 'exit' question
         * @private
         * @method startTrial
         */
        startTrial: function(startId) {
            var duringDisplayFn, onHideFn, onDisplayFn, serverCommDelay, remainingDelay;
            //All questions have been hidden, so display the parent block again
            //$('Questions').style.display = 'block';

            QRTE.loadWaitingList[startId] = true;
            if (!QRTE.loadWaitingList.every()) {
                QRTE.log('Process ' + startId + 'finished, waiting for other processes to finish')
                return;
            }

            //Save the absolute time of when onLoad part of library was finished
            serverCommDelay = window.requestAnimationFrame.now() - QRTE.getBlockData('QRTLib_previousEndTime'); //Calculate the remaining time based on the lib initialization + server delay times
            remainingDelay = QRTE.getBlockData('QRTLib_intraTrialDelay') - serverCommDelay;


            if (isNaN(remainingDelay)) {
                remainingDelay = QRTE.getBlockData('QRTLib_intraTrialDelay') * 3;
                //If this init call is the first one of the block (first trial), calculate the estimated refreshdelay during the pre-trial interval
                onDisplayFn = function(ele, time) {
                    QRTE.setTrialData('Init[OffsetTime]', ele.displayOnsetTime);
                    QRTE.setTrialData('Init[CalculatedDuration]', ele.displayOnsetTime - QRTE.getTrialData('Init[OnsetTime]'));
                    QRTE.refreshPeriodEstimationStack = [];
                };
                duringDisplayFn = function(ele, time) {
                    //Get current time, required for 
                    QRTE.refreshPeriodEstimationStack.push(time);
                };
                onHideFn = function(ele, timestamp) {
                    var diffs = [];

                    for (i = 1; i < QRTE.refreshPeriodEstimationStack.length; i += 1) {
                        diffs[i - 1] = QRTE.refreshPeriodEstimationStack[i] - QRTE.refreshPeriodEstimationStack[i - 1];
                    }
                    QRTE.refreshPeriod = QRTE.median(diffs);
                    QRTE.log('Estimated refresh delay = ' + QRTE.refreshPeriod);
                    QRTE.setBlockData('QRTE_refreshPeriod', QRTE.refreshPeriod);
                    QRTE.referenceTime = timestamp;
                    QRTE.framesSinceReference = 0;
                };
            } else {
                onDisplayFn = function(ele, time) {
                    QRTE.setTrialData('Init[OffsetTime]', ele.displayOnsetTime);
                    QRTE.setTrialData('Init[CalculatedDuration]', ele.displayOnsetTime - QRTE.getTrialData('Init[OnsetTime]'));
                };

                QRTE.refreshPeriod = QRTE.getBlockData('QRTE_refreshPeriod');
            }

            //QRTE.setTrialData('ITI[Duration]', (remainingDelay > 0) ? remainingDelay : 0);
            QRTE.initTime = window.requestAnimationFrame.now();

            QRTE.postInitElement.onHideFn = onHideFn;
            QRTE.postInitElement.onDisplayFn = onDisplayFn;
            QRTE.postInitElement.duringDisplayFn = duringDisplayFn;
            QRTE.setConfig('InitPost', 'duration', (remainingDelay > 0) ? remainingDelay : 0);
            //UNCOMMENT
            //QRTE.setConfig('InitPost', 'duration', (remainingDelay > 0) ? remainingDelay : Infinity);
            QRTE.inited = true;

            //Set initial trial data related to loading of this trial
            QRTE.setTrialData('InitServerComm[Onset]', QRTE.getBlockData('ServerCommOnset'));
            QRTE.setTrialData('InitServerComm[Offset]', QRTE.getBlockData('ServerCommOffset'));
            QRTE.setTrialData('InitServerComm[CalculatedDuration]', QRTE.getBlockData('ServerCommOffset') - QRTE.getBlockData('ServerCommOnset'));

            //<Load next trial here>
            var currentLoops = '${lm://CurrentLoopNumber}',
                totalLoops = '${lm://TotalLoops}';
            //Check if last trial, currentloops === totalLoops;
            QRTEController.requestNextTrial(currentLoops !== '' && currentLoops === totalLoops);

            QRTE.proceed();
        },



        proceed: function() {
            QRTE.log("proceed called after " + window.requestAnimationFrame.now() - QRTE.initTime);
            QRTE.hideAllElements();
        },

        proceedPage: function() {
            var currentQ;
            QRTE.log("Proceeding page..");
            while (QRTE.currentPageQuestions.length > 0) {
                currentQ = QRTE.currentPageQuestions.shift();

                //Disable
                currentQ.questionElement.QRTLib_isActive = false;
            }


            //Go to next question
            QRTE.showNextPage();
        },

        disableQuestion: function(disableQ) {},

        /**
         * Determine and show the next page/slide
         * @private
         * @method showNextPage
         */
        showNextPage: function() {
            var continueSearch = true,
                shownQ = false,
                nextQ,
                shown;
            while (continueSearch === true) {
                continueSearch = false;
                nextQ = QRTE.questionQueue.shift();
                if (nextQ !== undefined && (nextQ.type === 'Stimulus' || nextQ.type === 'Storage')) {
                    QRTE.currentPageQuestions.push(nextQ);
                    shown = QRTE.showStimulusQuestion.apply(nextQ.questionElement, [nextQ]);

                    if (nextQ.stimContinue) {
                        continueSearch = true;
                        if (shown === true) {
                            shownQ = true;
                        }
                    }
                    QRTE.log('shown ' + nextQ.id + ': ' + shown);
                    QRTE.log('continue ' + nextQ.id + ': ' + continueSearch);
                    if (shown === false && shownQ === false) {
                        continueSearch = true;
                    }
                }
            }

        },

        /**
         * Show Question
         * Handles the activation of that question, which includes:
         * The loading of the configuration (duration, allowable keys etc).
         * Sets the event handler to respond to any key presses during the event.
         * @private
         * @method showStimulusQuestion
         * @param question {Object} question to be shown.
         *  @param id {String} Id of question.
         *  @param onShowFunc {Function} Function to be called when showing question
         *  @param loadConfig {Boolean} If true, config is loaded from the current block data (which has been defined elsewhere)
         *  @param questionElement {Object} This Qualtrics question element
         *  @param duringDisplayFn {Function} Function to be called each frame that the question is presented
         */
        showStimulusQuestion: function(question) {
            //Save the loading start time
            //QRTE.setTrialData(question.questionElement.QRTLibId + '[LoadStartTime]', window.requestAnimationFrame.now());
            //Set mapping of the QID -> QRTE Id
            QRTE.setId(this, question.id);

            //Initialize variables
            var stimulusShown = false,
                questionScope = this,
                dispEle;
            QRTE.log(question);

            //Check whether question should be shown or not, if not skip to the next question (implicitly)
            if (question.conditional() === true) {
                this.QRTLib_isActive = true;


                if (question.loadConfig === true) {
                    //Load the Configuration of the Question, important!
                    QRTE.loadConfig(this);
                }

                //Check if KeyPress listener is required (one or more of the following fields are defined: onKeyPress, onCorrectKey or onAllowableKey)
                //If so, add keypress listener.
                if (question.onKeyPress !== undefined || question.questionElement.allowable !== '' || question.questionElement.cresp !== '') {
                    //Initialize the fields used for storing data about RT timing.
                    QRTE.setTrialData(question.questionElement.QRTLibId + '[RTTime]', '');
                    QRTE.setTrialData(question.questionElement.QRTLibId + '[RT]', '');
                    QRTE.setTrialData(question.questionElement.QRTLibId + '[RESP]', '');
                    QRTE.setTrialData(question.questionElement.QRTLibId + '[ACC]', 0);

                    //Add the key listener
                    QRTE.addKeyListener(function(e) {

                        //Get the Key of the response
                        var RT, RESP = QRTE.keycode2string(e),
                            RTTime = window.requestAnimationFrame.now();
                        RT = RTTime - QRTE.getTrialData(question.questionElement.QRTLibId + '[OnsetTime]');

                        //Store the Time of the Key Press and calculate the RT and ACC if correct

                        if ((QRTE.isAllowableResponse(question.questionElement, RESP) || QRTE.isCorrectResponse(question.questionElement, RESP)) && QRTE.getTrialData(question.questionElement.QRTLibId + '[RTTime]') === '') {
                            QRTE.setTrialData(question.questionElement.QRTLibId + '[RTTime]', RTTime);
                            QRTE.setTrialData(question.questionElement.QRTLibId + '[RT]', RT);
                            QRTE.setTrialData(question.questionElement.QRTLibId + '[RESP]', RESP);
                            if (QRTE.isCorrectResponse(question.questionElement, RESP)) {
                                QRTE.saveAcc(question.questionElement, 1);
                            } else {
                                QRTE.saveAcc(question.questionElement, 0);
                            }
                        }

                        //Store the RT and the Response

                        //Set Handling Key Press to true, this lets the engine know that a keypress is currently being handled. Necessary when there is a timer (response deadline)
                        question.handlingKeyPress = true;

                        if (question.onCorrectKey !== undefined && QRTE.isCorrectResponse(question.questionElement, RESP)) {
                            question.onCorrectKey.apply(question.questionElement, [e, RESP]);
                        } else if (question.onIncorrectKey !== undefined && QRTE.isAllowableResponse(question.questionElement, RESP)) {
                            question.onIncorrectKey.apply(question.questionElement, [e, RESP]);
                        }

                        if (question.onAllowableKey !== undefined && QRTE.isAllowableResponse(question.questionElement, RESP)) {
                            question.onAllowableKey.apply(question.questionElement, [e, RESP]);
                        }

                        if (question.onKeyPress !== undefined) {
                            question.onKeyPress.apply(question.questionElement, [e, RESP]);
                        }

                        if (question.questionElement.endAction === 'TERMINATE') {
                            //Proceed to the next Question Page if the response is allowable
                            if (QRTE.isAllowableResponse(question.questionElement, RESP) && question.questionElement.QRTLib_isActive === true) {
                                question.questionElement.proceed();
                            }
                        }
                        question.handlingKeyPress = false;

                    }, this);
                }

                //Build the display Element. Stimuli Questions have to take into account the possibility of being associated with a key press. 
                //OnDisplayFn therefore logs the displayOnsetTime, so that the RT can be calculated.
                dispEle = {
                    el: this.questionContainer,
                    duration: this.duration,
                    delay: this.offset,
                    duringDisplayFn: question.duringDisplayFn,
                    onDisplayFn: function(displayEl, timestamp) {
                        if (question.onDisplayFn !== undefined) {
                            question.onDisplayFn(displayEl, timestamp);
                        }
                        QRTE.setTrialData(questionScope.QRTLibId + '[OnsetTime]', displayEl.displayOnsetTime);
                    },
                    proceedOnHide: question.proceedOnHide,
                    id: question.id
                };

                //Set the OnHide Function
                dispEle.onHideFn = function(displayEl, timestamp) {
                    if (question.onHideFn !== undefined) {
                        question.onHideFn(displayEl, timestamp);
                    }
                    QRTE.setTrialData(questionScope.QRTLibId + '[OffsetTime]', displayEl.displayOffsetTime);
                    QRTE.setTrialData(questionScope.QRTLibId + '[CalculatedDuration]', displayEl.displayDuration);
                };


                this.QRTLib_timer = QRTE.displayElement(dispEle);

                question.onShowFunc.apply(this);

                stimulusShown = true;
            }

            //QRTE.setTrialData(question.questionElement.QRTLibId + '[LoadEndTime]', window.requestAnimationFrame.now());
            return stimulusShown;
        },

        setId: function(question, desc) {

            this.idCache[question.questionId] = desc;
            question.qId = desc;

            Qualtrics.SurveyEngine.setEmbeddedData(QRTE.idField, Object.toJSON(this.idCache));
        },

        getOutputKey: function(key) {
            var oldKey;
            for (oldKey in this.idCache) {
                if (this.idCache.hasOwnProperty(oldKey) && oldKey === key.substring(0, oldKey.length)) {

                    return QRTE.getBlockData('QRTLib_currentBlock') + this.idCache[oldKey] + key.substring(oldKey.length, key.length);
                }
            }
            return key;
        },


        OnKeyPress: function(fn, qScope) {

            qScope = qScope || window;

            var keyFn = function(e) {
                QRTE.setTrialData(qScope.QRTLibId + '[RTTime]', window.requestAnimationFrame.now());
                var RT = QRTE.getTrialData(qScope.QRTLibId + '[RTTime]') - QRTE.getTrialData(qScope.QRTLibId + '[OnsetTime]');
                QRTE.setTrialData(qScope.QRTLibId + '[RT]', RT);
                QRTE.setTrialData(qScope.QRTLibId + '[RESP]', QRTE.keycode2string(e));
                QRTE.log(qScope);
                fn.apply(qScope, [e]);
            }

            QRTE.addKeyListener(keyFn, qScope);
        },

        addKeyListener: function(fn, listenerScope) {
            Event.observe(document, 'keypress', function(e) {
                if (listenerScope.QRTLib_isActive === true) {
                    fn.apply(listenerScope, [e]);
                }
            });
        },

        /*  
         **************Methods below this line are support methods*******************
         */

        hideQuestions: function() {
            qArray = $('Questions').getElementsByClassName('QuestionOuter');
            for (var i = 0; i < qArray.length; i += 1) {
                qArray[i].style.display = 'none';
            }
        },

        unhideQuestions: function() {
            //Redisplay outer questions
            qArray = $('Questions').getElementsByClassName('QuestionOuter');
            for (var i = 0; i < qArray.length; i += 1) {
                qArray[i].style.display = 'block';
            }
            //Redisplay separators
            qArray = $('Questions').getElementsByClassName('Separator');
            for (var i = 0; i < qArray.length; i += 1) {
                qArray[i].style.display = 'block';
            }


        },

        _handleKeyPressEvent: function() {

        },

        _setConfig: function(QID, option, value, setterFunc) {
            var qidString = QID;
            if (typeof QID !== 'string') {
                qidString = QID.questionId;
            }
            option = option.toLowerCase();

            switch (option) {
                case 'duration':
                    if (value instanceof Array) {
                        value = value[Math.floor(Math.random() * value.length)];
                    }
                    setterFunc.apply(this, [qidString, 'Duration', value]);
                    break;
                case 'allowable':
                    setterFunc.apply(this, [qidString, 'Allowable', value]);
                    break;
                case 'cresp':
                    setterFunc.apply(this, [qidString, 'CRESP', value]);
                    break;
                case 'delay':
                    setterFunc.apply(this, [qidString, 'Offset', value]);
                    break;
                case 'endaction':
                    setterFunc.apply(this, [qidString, 'EndAction', value]);
                    break;
                default:
                    QRTE.log('No such configuration: ' + option);
                    break;
            }
        },
        getDuration: function(question) {
            var duration = Infinity,
                edDuration = this.getTrialData(question.QRTLib_configId + '[Duration]');
            if (edDuration !== undefined && edDuration !== '' && !isNaN(edDuration)) {
                duration = edDuration;
            }
            if (question._Duration !== undefined && question._Duration !== '' && !isNaN(question._Duration)) {
                duration = question._Duration;
            }

            return duration;
        },
        getAllowable: function(question) {
            var allowable = "",
                edAllowable = this.getTrialData(question.QRTLib_configId + '[Allowable]');
            if (edAllowable !== undefined) {
                allowable = edAllowable;
            }
            if (question._Allowable !== undefined) {
                allowable = question._Allowable;
            }

            if (allowable === '{ANY}') {
                allowable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-=[]\\;',./`";
            }
            //allowable = allowable.toUpperCase();
            return allowable;
        },
        getCResp: function(question) {
            var cresp = '',
                edcresp = this.getTrialData(question.QRTLib_configId + '[CRESP]');
            if (edcresp !== undefined) {
                cresp = edcresp;
            }
            if (question._cresp !== undefined) {
                cresp = question._CRESP;
            }

            if (cresp === '{ANY}') {
                cresp = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890-=[]\\;',./`";
            }
            //cresp = cresp.toUpperCase();

            return cresp;
        },

        getOffset: function(question) {
            var offset = 0,
                edOffset = this.getTrialData(question.QRTLib_configId + '[Offset]');
            if (edOffset !== undefined && edOffset !== '' && !isNaN(edOffset)) {
                offset = edOffset;
            }
            if (question._Offset !== undefined && question._Offset !== '' && !isNaN(question._Offset)) {
                offset = question._Offset;
            }

            return offset;

        },

        getEndAction: function(question) {
            var endAction = 'NONE',
                edEndAction = this.getTrialData(question.QRTLib_configId + '[EndAction]');
            if (edEndAction !== undefined && edEndAction !== '') {
                endAction = edEndAction;
            }
            if (question._EndAction !== undefined && question._EndAction !== '') {
                endAction = question._EndAction;
            }

            return endAction;

        },
        evaluateConditional: function(conditional) {
            QRTE.log('Conditional: ', conditional);
            return conditional === '' || conditional();
        },
        log: function() {
            if (QRTE.debug === true) {
                for (var i = 0; i < arguments.length; i += 1) {
                    console.log(arguments[i]);
                }
            }
        },

        median: function(values) {

            values.sort(function(a, b) {
                return a - b;
            });

            var half = Math.floor(values.length / 2);

            if (values.length % 2) return values[half];
            else return (values[half - 1] + values[half]) / 2.0;
        },

        waitForKey: function(question, keys) {
            Event.observe(document, 'keypress', function(e) {
                var resp = QRTE.keycode2string(e);
                if (keys.indexOf(resp) >= 0) {
                    question.clickNextButton();
                }
            });
        },

        validateParams: function(paramObj, validationArray) {
            var valObj, val, index, typeCheck = true,
                indexType;
            //Loop over validationArray to check whether parameters suffice
            for (index = 0; index < validationArray.length; index += 1) {
                valObj = validationArray[index];
                if (paramObj[valObj.name] === undefined && valObj.required === true) {
                    alert('Required parameter: ' + valObj.name + ' seems to be missing');
                    QRTE.log('Required parameter: ' + valObj.name + ' seems to be missing');
                    break;
                }

                val = paramObj[valObj.name];

                //Loop over type checkers
                for (indexType = 0; indexType < valObj.type.length; indexType += 1) {
                    typeCheck = QRTE.validateType(val, valObj.type[indexType]);
                    if (typeCheck === true) {
                        break;
                    }
                }
                if (typeCheck === false && valObj.required === true) {
                    alert('Parameter: ' + valObj.name + ' is of the wrong type, expected type: ' + valObj.type + ', type received: ' + (typeof val) + "\n" + "Please open the console for detailed error messages");
                    QRTE.log('Parameter: ' + valObj.name + ' is of the wrong type, expected type: ' + valObj.type + ', type received: ' + (typeof val));
                    QRTE.log('Faulty parameter ' + valObj.name + ': ', val);
                    QRTE.log('Proper functioning of QRTE is no longer guaranteed, please fix the above error');
                }

            }
        },

        validateType: function(val, type) {
            switch (type) {
                case 'JSON':
                    return val.isJSON();
                case 'String':
                    return (typeof val === 'string' || val instanceof String);
                case 'Number':
                    return (!isNaN(parseFloat(val)) && isFinite(val));
                case 'Array':
                    return val instanceof Array;
                case 'Object':
                    return typeof val === 'object';
                case 'Function':
                    return typeof val === 'function';
                case 'Boolean':
                    return (val === true || val === false);
                case 'Empty':
                    return val === '';
                default:
                    return false;
            }
        },

        fixSetEmbeddedDataBug: function() {
            Qualtrics.SurveyEngine.setEmbeddedData = function(key, value) {
                var fieldName = 'ED~' + key;
                if ($(fieldName)) {
                    $(fieldName).value = value;
                } else {
                    $('Header').appendChild(QBuilder('input', {
                        type: 'hidden',
                        id: fieldName,
                        name: fieldName,
                        value: value
                    }));
                    Qualtrics.SurveyEngine.setEmbeddedData(key, value);
                }
            }
        },

        //DisplayEngine part

        //Since it's impossible to know when a screen refresh has happened, we assume that the first timestamp is the actual screen refresh.
        //Based on the difference between the current timestamp Tn and the root timestamp Tn-1, we estimate the amount of frames that have passed since. 
        //Based on the amount of frames we estimate the previous screen refresh. Although not perfect, it's the best we can do.

        refreshRate: 60, //hertz
        refreshPeriod: 1000 / 60,
        lastRefresh: 0,
        currentRefresh: 0,
        previousTimestamp: 0,
        referenceTime: 0,
        framesSinceReference: 0,
        currentStack: [],
        proceedOnFrameEnd: false,

        init: function() {
            window.requestAnimationFrame(QRTE.draw);
        },

        draw: function(timestamp) {
            var curEle, newStack = [];
            timestamp = window.requestAnimationFrame.now();


            if (timestamp < 1e12) {
                timestamp += window.performance.timing.navigationStart;
            }

            if (QRTE.referenceTime === 0) {
                QRTE.referenceTime = timestamp;
                QRTE.previousTimestamp = timestamp;
                QRTE.framesSinceReference = 0;
            } else {
                //QRTE.framesSinceReference += QRTE.calcFrames(QRTE.referenceTime, timestamp);
                QRTE.prevFrames = QRTE.framesSinceReference;
                //frameDiff =  QRTE.calcFrames(QRTE.referenceTime, timestamp) - QRTE.prevFrames;
                QRTE.framesSinceReference = QRTE.calcFrames(QRTE.referenceTime, timestamp);
            }
            QRTE.currentRefresh = (QRTE.framesSinceReference * QRTE.refreshPeriod) + QRTE.referenceTime;
            QRTE.projectedRefresh = QRTE.currentRefresh + QRTE.refreshPeriod;
            curEle = QRTE.currentStack.shift();

            while (curEle) {
                curEle.keep = true;

                //Call duringDisplay callback function, with the current element and the timestamp as arguments.
                if (curEle.shown === true && typeof curEle.duringDisplayFn === 'function') {
                    curEle.duringDisplayFn(curEle, timestamp);
                }

                if (QRTE.proceedOnFrameEnd === true || curEle.hide === true || (curEle.shown === true && curEle.displayOnset !== undefined && (curEle.displayOnset + curEle.duration < QRTE.projectedRefresh))) {
                    //If the next refresh makes it go beyond the duration, hide the element again!
                    curEle = QRTE.hideSingleEle(curEle, timestamp);
                } else if (curEle.shown === false && curEle.requestedAt + curEle.delay < QRTE.projectedRefresh) {
                    curEle = QRTE.dispSingleEle(curEle, timestamp);
                }

                if (curEle.keep === false && curEle.proceedOnHide === true) {
                    //Behold! We have found an element that commands us to proceed to the next page.
                    QRTE.proceedOnFrameEnd = true;
                    //Every element that has been processed so far needs to be re-processed (sadly), so that they properly hide.
                    for (var ind = 0; ind < newStack.length; ind += 1) {
                        if (newStack[ind].hide !== true) {
                            newStack[ind].hide = true;
                            QRTE.currentStack.push(newStack[ind]);
                        }
                    }
                } else {
                    //Push it to the newStack, for it to be processed next time.
                    newStack.push(curEle);
                }

                curEle = QRTE.currentStack.shift();
            }
            QRTE.currentStack = newStack;
            QRTE.lastRefresh = QRTE.currentRefresh;
            QRTE.previousTimestamp = timestamp;
            window.requestAnimationFrame(QRTE.draw);
            if ((newStack.length === 0 || QRTE.proceedOnFrameEnd) && QRTE.inited === true) {
                QRTE.proceedOnFrameEnd = false;
                QRTE.proceedPage();
            }


        },

        calcFrames: function(previous, current) {
            var diff = current - previous,
                frames = 0;

            if (diff < QRTE.refreshPeriod) {
                frames = 1;
            } else {
                frames = Math.floor(diff / QRTE.refreshPeriod);
                if (diff % QRTE.refreshPeriod >= (QRTE.refreshPeriod * 0.9)) {
                    frames += 1;
                }
            }

            return frames;
        },

        /**
         * Display an element for a specified duration with a specified delay. Vsyncs the display duration using requestAnimationFrame (if possible in the browser)
         * and allows for high-precision control over its duration. Please start any custom attributes for the paramObj with the 'custom_' header, to avoid collisions.
         * @private
         * @method displayElement
         * @param paramObj {Object}
         *  @param el {Object} HTML element to be displayed
         *  @param [onHideFn] {Function} Function to be called upon removing the element from display, is passed one argument containing all information about the display element.
         *  @param [duration] {Number} Number of milliseconds (ms) the element should be displayed.
         *  @param [delay] {Number} Number of milliseconds (ms) the Engine should wait before displaying the element.
         *  @param [duringDisplayFn] {Function} Function to be called upon displaying the element for another screen refresh. Careful: Keep this function simple, could seriously hamper performance as it's called about every 16-17 ms.  is passed one argument containing all information about the display element.
         *  @param [onDisplayfn] {Function} Function to be called upon starting to display the element. Is passed one argument containing all information about the display element.
         */

        //displayElement: function(el, callback, duration, offset, duringDisplaycb) {
        displayElement: function(paramObj) {
            var reqAt,
                id = String(Math.random());
            //QRTE.log(arguments);
            if (paramObj.delay === undefined) {
                paramObj.delay = 0;
            }



            if (paramObj.duration === undefined) {
                paramObj = Infinity;
            }

            if (isNaN(QRTE.lastRefresh)) {
                reqAt = window.requestAnimationFrame.now();
            } else {
                reqAt = QRTE.lastRefresh;
            }
            paramObj.userId = paramObj.id;
            paramObj.id = id;
            paramObj.shown = false;
            paramObj.requestedAt = reqAt;
            paramObj.hide = false;

            QRTE.currentStack.push(paramObj);
            if (paramObj.delay === 0) {
                //This element needs to be displayed as soon as possible
                QRTE.dispSingleEle(paramObj, QRTE.previousTimestamp);
            }
            QRTE.log('Added element to display stack:', paramObj);
            //console.log('paramObj: ', paramObj.userId, ', duration: ', paramObj.duration);

            return id;
        },

        hideElement: function(id) {
            var found = false,
                i;
            for (i = 0; i < QRTE.currentStack.length; i += 1) {
                if (QRTE.currentStack[i].id === id) {
                    found = true;
                    QRTE.currentStack[i].hide = true;
                    this.log('Element to be hidden: ', QRTE.currentStack[i]);
                }
            }
            return found;
        },

        hideAllElements: function() {
            for (i = 0; i < QRTE.currentStack.length; i += 1) {
                QRTE.currentStack[i].hide = true;
            }
            QRTE.proceedOnFrameEnd = true;
        },

        /**
         * Hide a DrawEngine Element
         * @private
         * @method hideSingleEle
         * @param curEle {Object}
         */
        hideSingleEle: function(curEle, timestamp) {
            curEle.displayOffset = QRTE.projectedRefresh;
            curEle.displayOffsetTime = window.requestAnimationFrame.now();
            curEle.el.style.display = 'none';
            curEle.keep = false;
            curEle.hide = true;
            //delete QRTE.currentStack[key];
            curEle.displayDuration = curEle.displayOffsetTime - curEle.displayOnsetTime;
            if (curEle.onHideFn !== undefined) {
                curEle.onHideFn(curEle, timestamp);
            }

            return curEle;

        },


        /**
         * Display a DrawEngine Element
         * @private
         * @method dispSingleEle
         * @param curEle {Object}
         */
        dispSingleEle: function(curEle, timestamp) {
            curEle.el.style.display = 'block';
            curEle.displayOnset = QRTE.projectedRefresh;
            curEle.displayOnsetTime = window.requestAnimationFrame.now();
            curEle.shown = true;
            if (curEle.onDisplayFn !== undefined) {
                //Added try-catch block to catch the error that's causing the OnsetTime not to get saved.
                try {
                    curEle.onDisplayFn(curEle, timestamp);
                } catch (e) {
                    QRTE.setTrialData('Error[OnsetError]', JSON.stringify(e));
                }
            }
            return curEle;
        },

        checkEngineCompatibility: function() {
            return window.requestAnimationFrame.method === 'native-highres';
        },
    };

    if (typeof QRTEController == 'undefined') {
        //QRTE SurveySlider controller layer
        //Takes care of progressing through the survey. Catches all qualtrics native ways of submitting the form and replaces that by
        //its own asynchronous ajax stuff.
        QRTEController = {


            //This plug-in to QRTEngine has been developed under the name SurveySlider
            // for general Qualtrics Surveys. It has been adapted to work with QRTEngine
            nextTrialContainer: null,
            nextTrialText: '',
            currentForm: null,
            previousForm: null,
            handlingSubmit: false,
            onSubmitStack: [],
            inited: false,
            childInputs: [],
            loadUponCallback: false,
            setEmbeddedData: function() {},
            tempED: {},



            //Initialize thecontroller
            init: function() {
                this.nextTrialContainer = new Element('div', {
                    id: 'nextTrialContainer'
                });
                this.currentForm = $$('form')[0];

                //Catch submits and change it with our own submit function (which does AJAX submissions)
                //this.currentForm.observe('QRTE:submit', QRTE.handleSubmit);
                this.currentElements = $$('.QuestionOuter');

                //Initial SSload firing
                Qualtrics.SurveyEngine.addOnload(function() {
                    QRTEController.currentForm.fire('QRTE:load');
                });
                //Change SurveyEngine.OnLoad to trigger on SSload, rather than page load
                Qualtrics.SurveyEngine.addOnload = function(f) {
                        var questions = $$('.QuestionOuter'),
                            currentCount = QRTEController.count(Qualtrics.SurveyEngine.QuestionInfo),
                            id = questions[currentCount - 1].id;
                        if ($('body') && $('body').hasClassName('EditSection')) return;
                        try {
                            var obj = new Qualtrics.SurveyEngine.QuestionData(id);
                            obj.onload = f;

                            QRTEController.currentForm.observe('QRTE:load', obj.onload.bind(obj));
                            //Event.observe(this.currentForm, 'SSload', obj.onload.bind(obj));
                        } catch (e) {
                            console.error('SE API Error: ' + e);
                        }
                    }
                    //Set the Qualtrics setEmbeddedData to inside the QRTEController
                QRTEController.setEmbeddedData = Qualtrics.SurveyEngine.setEmbeddedData;
                Qualtrics.SurveyEngine.setEmbeddedData = function(key, value) {
                    QRTEController.tempED[key] = value;
                }
                this.submitPage = this.requestNextTrial;
                this.inited = true;
            },

            /**
             * Requests the next trial from the Qualtrics server.
             *
             *
             */
            requestNextTrial: function(isLastTrial) {

                //If this is the last trial of a block, DON'T request the next page, let qualtrics handle it themselves
                if (this.handlingSubmit === false && isLastTrial === false) {
                    //Load next trial means that current page is a trial and has been inited
                    //Need to remove relevant input elements from current form before submitting
                    //After that add them back
                    this.handlingSubmit = true
                    var childs = $$('form input[type=text]'),
                        childInputs = [];
                    //remove current input elements from the form
                    for (var i = 0; i < childs.length; i += 1) {
                        childInputs[i] = {
                            ele: childs[i],
                            parent: childs[i].up()
                        };
                        childs[i].remove();
                    }
                    //add previous input elements to form
                    //Text inputs
                    for (var i = 0; i < this.childInputs.length; i += 1) {
                        this.childInputs[i].ele.style.display = 'none';
                        this.currentForm.insert(this.childInputs[i].ele);
                    }


                    //And embedded data
                    for (var key in this.tempED) {
                        if (this.tempED.hasOwnProperty(key)) {
                            QRTEController.setEmbeddedData(key, this.tempED[key]);
                        }
                    }
                    //Reset stored embedded data
                    this.tempED = {};
                    //set new childs
                    this.childInputs = childInputs;

                    //Loop over submit stack, or callbacks that need to be finished before submitting
                    for (var i = 0; i < QRTEController.onSubmitStack.length; i += 1) {
                        QRTE.onSubmitStack[i]();
                    }
                    QRTEController.onSubmitStack = [];
                    this.currentForm.request({
                        onComplete: this.requestNextTrialCallback
                    });

                    //Set server comm onset for the next trial
                    QRTE.setBlockData('ServerCommOnset', window.requestAnimationFrame.now());

                    QRTEController.betweenSubmits = true;

                    for (var i = 0; i < this.childInputs.length; i += 1) {
                        this.childInputs[i].parent.insert(this.childInputs[i].ele);
                        this.childInputs[i].ele.style.display = 'none';
                    }
                } else if (isLastTrial === true) {
                    //Just add the previous trial's childInputs to the form 
                    for (var i = 0; i < this.childInputs.length; i += 1) {

                        this.currentForm.insert(this.childInputs[i].ele);
                        this.childInputs[i].ele.style.display = 'none';
                    }

                    this.loadNextTrial = function() {
                        //Directly submitting the form doesn't seem to work? Let's do it through NextButton click
                        $('NextButton').click();
                    };
                }
            },

            loadNextTrial: function() {
                if (this.handlingSubmit === true) {
                    //The submit still hasn't returned..
                    this.loadUponCallback = true;
                    return;

                }
                //Set handling submit to false (as page has been returned)
                //Save the previous form
                this.previousForm = this.currentForm;
                //Reset the QuestionInfo object, this is for Qualtrics to correctly initiate its own page
                Qualtrics.SurveyEngine.QuestionInfo = {}
                    //Parse the HTML that was returned earlier and set it as the current trial container's contents
                this.nextTrialContainer = jQuery(this.nextTrialContainer).html(this.nextTrialText)[0];
                //Filter out the 'form' field, and append it back.
                this.currentForm = jQuery(this.nextTrialContainer).find('form')[0];
                jQuery(this.previousForm).replaceWith(jQuery(this.currentForm));

                jQuery(this.currentForm).show();

                if (this.currentForm.select('.END_OF_SURVEY').length === 0) {
                    this.currentForm.fire('QRTE:load');
                    this.submitPage = this.requestNextTrial;
                } else {
                    this.submitPage = this.currentForm.submit;
                }

            },

            requestNextTrialCallback: function(e) {
                QRTEController.nextTrialText = e.responseText;
                QRTEController.handlingSubmit = false;
                QRTE.setBlockData('ServerCommOffset', window.requestAnimationFrame.now());

                if (QRTEController.loadUponCallback === true) {
                    QRTEController.loadUponCallback = false;
                    QRTEController.loadNextTrial();
                }
            },

            submitPage: function() {
                console.log('Not yet initialised');
            },

            count: function(obj) {
                var count = 0;

                for (var prop in obj) {
                    if (obj.hasOwnProperty(prop))
                        ++count;
                }

                return count;
            },

            BDCache: {},
            storeBlockData: function(blockData) {
                this.BDCache = blockData;
            },

            loadBlockData: function() {
                return this.BDCache;
            }
        };

        document.observe('dom:loaded', QRTEController.init.bind(QRTEController));


        (function() {
            var lastFrame, method, now, queue, requestAnimationFrame, timer, vendor, _i, _len, _ref, _ref1;
            method = 'native';
            now = Date.now || function() {
                return new Date().getTime();
            };
            requestAnimationFrame = window.requestAnimationFrame;
            _ref = ['webkit', 'moz', 'o', 'ms'];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                vendor = _ref[_i];
                if (!(requestAnimationFrame != null)) {
                    requestAnimationFrame = window[vendor + "RequestAnimationFrame"];
                }
            }
            if (!(requestAnimationFrame != null)) {
                method = 'timer';
                lastFrame = 0;
                queue = timer = null;
                requestAnimationFrame = function(callback) {
                    var fire, nextFrame, time;
                    if (queue != null) {
                        queue.push(callback);
                        return;
                    }
                    time = now();
                    nextFrame = Math.max(0, 16.66 - (time - lastFrame));
                    queue = [callback];
                    lastFrame = time + nextFrame;
                    fire = function() {
                        var cb, q, _j, _len1;
                        q = queue;
                        queue = null;
                        for (_j = 0, _len1 = q.length; _j < _len1; _j++) {
                            cb = q[_j];
                            cb(lastFrame);
                        }
                    };
                    timer = setTimeout(fire, nextFrame);
                };
            }
            requestAnimationFrame(function(time) {
                var _ref1;
                if ((((_ref1 = window.performance) != null ? _ref1.now : void 0) != null) && time < 1e12) {
                    requestAnimationFrame.now = function() {
                        return window.performance.now() + window.performance.timing.navigationStart;
                    };
                    requestAnimationFrame.method = 'native-highres';
                } else {
                    requestAnimationFrame.now = now;
                }
            });
            requestAnimationFrame.now = ((_ref1 = window.performance) != null ? _ref1.now : void 0) != null ? (function() {
                return window.performance.now() + window.performance.timing.navigationStart;
            }) : now;
            requestAnimationFrame.method = method;
            window.requestAnimationFrame = requestAnimationFrame;
        })();

        function loadScript(url, callback) {

            var script = document.createElement("script")
            script.type = "text/javascript";

            if (script.readyState) { //IE
                script.onreadystatechange = function() {
                    if (script.readyState == "loaded" || script.readyState == "complete") {
                        script.onreadystatechange = null;
                        callback();
                    }

                };
            } else { //Others
                script.onload = function() {
                    callback();
                };
            }

            script.src = url;
            document.getElementsByTagName("head")[0].appendChild(script);
        }

        (function() {

            //jQuery is only required for the Fixation flash fix. prototypejs is unable to efficiently replace elements
            //and introduces a 10 ms delay between loading element and firing off the scripts. Unacceptable
            //First time jQuery should be used is the second trial

            loadScript("https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js", function() {

                $.noConflict();

            });

        })();

        //If preview mode is run (PreviewBanner element exists, add a QRTEngine plug with id QRTEPlug)

        if ($('PreviewBanner')) {
            var plug, row, banner = $('PreviewBanner');
            //Go down to the first table row inside that banner
            row = banner.children[0].children[0].children[0];
            //Insert new cell    
            plug = row.insertCell(2);
            plug.id = "QRTEPlug";
            plug.width = "20%";
            plug.innerHTML = 'This survey is proudly and successfully powered by <a href="http://qrtengine.com" target="_blank"><i><b>QRTEngine</b></i></a>';
            plug.style.textAlign = "center";
        }
    }
</script>
<script>
    QRTE.debug = true;

    QRTLib = QRTE;
</script>
<style type="text/css">
    #Plug {
        display: none;
    }
    #NextButton {
        display: none;
    }
    #PreviousButton {
        display: none;
    }
    html {
        height: 100%;
    }
    body {
        height: 100%;
        padding: 0;
        padding-top: 0 !important;
        margin: 0;
    }
    .Skin {
        display: table;
        margin: auto;
        min-height: 100%;
        height: 100%;
    }
    #Page {
        height: 100%;
        min-height: 100%;
    }
    .SkinInner {
        min-height: 100%;
        display: table-cell;
        vertical-align: middle;
    }
    .QuestionText {
        border: 0px !important;
        border-bottom: 0px !important;
    }
    .QuestionOuter {
        display: none;
    }
    .Separator {
        display: none !important;
    }
    #SkinContent > #Buttons,
    .SkinInner > #Header {
        padding: 0 !important;
    }
</style>
