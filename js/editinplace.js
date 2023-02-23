// @flow

'use strict';

/*flow-include
declare var $: any
declare var ReactDOM: any
*/

/**
 * Compiled with Babel in the browser.
 *
 * Editor has two states:
 *   1) Show edit-buttons on hover
 *   2) Inject widget, hide hover buttons
 *   3) Save with success/fail, or cancel, return to 1
 */

// 'hover' or 'edit'
let editInPlaceState = 'hover';

/**
 * Tiny queue class to communicate between jQuery Ajax and React components that mount too late.
 */
class Queue {
    constructor() {
        this.messages = [];
    }

    add(message) {
        this.messages.push(message);
    }

    getNewMessages(containerId) {
        const newMessages = [];
        const newQueue = [];
        for (let i = 0; i < this.messages.length; i++) {
            const message = this.messages[i];
            if (message.containerId === containerId) {
                newMessages.push(message);
            } else {
                newQueue.push(message);
            }
        }
        this.messages = newQueue;
        return newMessages;
    }
}

// Messages of type QueueMessage
let editInPlaceQueue = new Queue();

class QueueMessage {
    constructor(containerId, content) {
        this.containerId = containerId;
        this.content = content;
    }
}

class BaseButton extends React.Component {
    constructor(props) {
        super(props);
        this.onclick = this.onclick.bind(this);
    }

    onclick() {
        throw 'not implemented';
    }

    render() {
        return <button onClick={this.onclick} className="btn btn-xs" data-toggle="tooltip" data-placement="right" title={this.props.tooltipTitle}>
            <i className={"fa fa-fw fa-" + this.props.icon}></i>
        </button>
    }
}

class MoveButton extends BaseButton {
    onclick() {
        this.props.flipState('saving');
        const that = this;
        const data = {};
        data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
        data.lang = editInPlaceGlobalData.lang;
        data.surveyId = editInPlaceGlobalData.surveyId;
        // NB: Container id is "question" + question id
        data.questionId = this.props.containerId.replace('question', '');

        $.post(
            this.props.moveUrl,
            data,
            function(data, textStatus, jqXHR) {
                const id = $('#' + that.props.containerId).parents('.group-outer-container').get(0).id
                resetGroupHtml(id).then(() => showSuccessMessage(that.props.containerId, "Question moved"));
            }
        );
    }
}

class AddNewQuestionButton extends BaseButton {
    onclick(event) {
        event.preventDefault();
        //this.props.flipState('saving');
        const data = {};
        const that = this;
        // TODO: Assumes group-by-group (exactly one group per page)
        const lastgroup = $('#lastgroup').val();    // sidXgid
        const parts = lastgroup.split('X');
        const groupId = parts[1];
        //data.questionId = this.props.containerId.replace('question', '');
        //data.surveyId = editInPlaceGlobalData.surveyId;
        data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
        data.lang = editInPlaceGlobalData.lang;
        data.groupId = groupId;
        $.post(
            editInPlaceGlobalData.addQuestionUrl,
            data,
            function(data, textStatus, jqXHR) {
                console.log('data', data);
                console.log('containerId', that.props.containerId);
                // TODO: Assumes group-by-group (exactly one group per page)
                const groupId = $('.group-outer-container').get(0).id;
                console.log('groupId', groupId);
                resetGroupHtml(groupId).then(() => showSuccessMessage(that.props.containerId, "Question added"));
            }
        )
            // TODO: Code duplication
            .fail(function(jqXHR) {
                const alertText = JSON.parse(jqXHR.responseText);
                const text = jqXHR.status + ": " + alertText;
                showErrorMessage(that.props.containerId, text);
                // Restore question, help, qid content
                // TODO: Need to resetContainerHtml here, some stuff might have been saved, other not
                for (const id in that.props.content) {
                    $(id).text(that.props.content[id]);
                }
                that.props.flipState('base');
            });
        return false;
    }

    render() {
        return <button onClick={this.onclick} className="btn" data-toggle="tooltip" title="Add question" data-placement="right" style={{borderRadius: 0, marginBottom: "5px"}}>
            <i className="fa fa-fw fa-plus"></i>
        </button>
    }
}

class ShowHiddenQuestions extends BaseButton {
    onclick(event) {
        event.preventDefault();
        console.log('ShowHiddenQuestions');
        $('.question-container').each(function(i) {
            console.log(i);
            if ($(this).hasClass('ls-hidden')) {
                $(this)
                    .removeClass('ls-irrelevant')
                    .removeClass('ls-hidden')
                    // Since opacity cannot be higher for children than for parent, we use another
                    // method to indicate that the question is not normal...
                    .css('border', 'dashed red');
            }
        });
        return false;
    }

    render() {
        return <button onClick={this.onclick} className="btn" data-toggle="tooltip" title="Show hidden questions" data-placement="right" style={{borderRadius: 0}}>
            <i className="fa fa-fw fa-eye"></i>
        </button>
    }
}

class SaveButton extends BaseButton {
    /**
     * Triggered when save-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    onclick(event) {
        event.preventDefault();
        const that = this;

        this.props.flipState('saving');

        const data = {};
        data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
        data.lang = editInPlaceGlobalData.lang;
        data.surveyId = editInPlaceGlobalData.surveyId;
        // NB: Container id is "question" + question id
        data.questionId = this.props.containerId.replace('question', '');
        const id = '#' + this.props.containerId;

        $(`${id} input, ${id} textarea`).each(function(i, el) {
            data[el.name] = el.value;
        });

        console.log('save data', data);

        // Post form and then reload the entire HTML
        $.post(
            editInPlaceGlobalData.saveUrl,
            data,
            function(data, textStatus, jqXHR) {
                console.log(data);
                resetContainerHtml(that.props.containerId)
                    .then(() => showSuccessMessage(that.props.containerId, "Question saved"));
            }
        )
            .fail(function(jqXHR) {
                const alertText = JSON.parse(jqXHR.responseText);
                const text = jqXHR.status + ": " + alertText;
                showErrorMessage(that.props.containerId, text);
                // Restore question, help, qid content
                // TODO: Need to resetContainerHtml here, some stuff might have been saved, other not
                for (const id in that.props.content) {
                    $(id).text(that.props.content[id]);
                }
                that.props.flipState('base');
            });
        return false;
    }
}

class EditButton extends BaseButton {
    /**
     * Triggered when edit-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    onclick(event) {
        event.preventDefault();

        const that = this;
        const data = {};
        data.lang = editInPlaceGlobalData.lang;
        data.questionId = this.props.containerId.replace('question', '');
        data.surveyId = editInPlaceGlobalData.surveyId;

        $.get(
            editInPlaceGlobalData.getTextsUrl,
            data,
            function(data, textStatus, jqXHR) {
                const ids = [
                    '#' + that.props.containerId + ' .question-text',
                    '#' + that.props.containerId + ' .question-code',
                    '#' + that.props.containerId + ' .ls-questionhelp'
                ];
                // TODO: Should be keys in ids array?
                const names = ['question', 'code', 'help'];
                const content = {};
                const replaceWithInput = function(id, i) {
                    // Text from database correctly shows EM
                    const text = data[names[i]];
                    // Old HTML = evaluated EM inside question text etc
                    const oldHtml = $(id).html();
                    content[id] = oldHtml;
                    const width = Math.min($(id).innerWidth(), 500);
                    //console.log('width', width);
                    const name = names[i];
                    $(id).html(`<textarea name="${name}" style="width: ${width}px;">${text}</textarea>`);
                };
                that.props.setContent(content);
                ids.forEach(replaceWithInput);
                that.props.flipState();
            }
        );

        return false;
    }
}

class CancelButton extends BaseButton {
    /**
     * Triggered when cancel-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    onclick(event) {
        event.preventDefault();
        for (const id in this.props.content) {
            $(id).html(this.props.content[id]);
        }
        this.props.flipState();
        return false;
    }
}

class MandatoryButtonGroup extends React.Component {
    render() {
        const mandatory = this.props.value;
        if (mandatory === undefined) {
            return "";
        } else {
            return <>
                <i className="fa fa-fw fa-exclamation" title="Mandatory" data-toggle="tooltip"></i>
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    <button className={"btn btn-xs " + (mandatory === "N" && "active")}>
                        <input value="N" type="radio" name="mandatory" id="option1" defaultChecked={mandatory === "N"} /> Off
                    </button>
                    <button className={"btn btn-xs " + (mandatory === "S" && "active")}>
                        <input value="S" type="radio" name="mandatory" id="option2" defaultChecked={mandatory === "S"} /> Soft
                    </button>
                    <button className={"btn btn-xs " + (mandatory === "Y" && "active")}>
                        <input value="Y" type="radio" name="mandatory" id="option3" defaultChecked={mandatory === "Y"} /> On
                    </button>
                </div>
            </>;
        }
    }
}

class EncryptedButtonGroup extends React.Component {
    render() {
        const encrypted = this.props.value;
        if (encrypted === undefined) {
            return "";
        } else {
            return <>
                <i className="fa fa-fw fa-lock" title="Encrypted" data-toggle="tooltip"></i>
                <div className="btn-group btn-group-toggle" data-toggle="buttons">
                    <button className={"btn btn-xs " + (encrypted === "Y" && "active")}>
                        <input value="Y" type="radio" name="encrypted" id="encrypted-option1" defaultChecked={encrypted === "Y"} /> On
                    </button>
                    <button className={"btn btn-xs " + (encrypted === "N" && "active")}>
                        <input value="N" type="radio" name="encrypted" id="encrypted-option1" defaultChecked={encrypted === "N"} /> Off
                    </button>
                </div>
            </>;
        }
    }
}

class SaveAdvancedForm extends BaseButton {
    onclick(event) {
        event.preventDefault();
        this.props.flipState('saving');

        const inputs = $(this.props.parent.current).find('input, select, textarea')
        const values = $(inputs).serializeArray();
        const data = {}
        const that = this;

        data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
        data.questionId = this.props.containerId.replace('question', '');
        values.forEach((el) => data[el.name] = el.value);

        $.post(
            editInPlaceGlobalData.saveAdvUrl,
            data,
            function(data, textStatus, jqXHR) {
                resetContainerHtml(that.props.containerId)
                    .then(() => showSuccessMessage(that.props.containerId, "Question saved"));
            }
        )
            .fail(function(jqXHR) {
                const alertText = JSON.parse(jqXHR.responseText);
                const text = jqXHR.status + ": " + alertText;
                showErrorMessage(that.props.containerId, text);
                // Restore question, help, qid content
                // TODO: Need to resetContainerHtml here, some stuff might have been saved, other not
                for (const id in that.props.content) {
                    $(id).text(that.props.content[id]);
                }
                that.props.flipState('base');
            });
    }
}

class DeleteQuestionButton extends BaseButton
{
    onclick(event) {
        event.preventDefault();
        const result = confirm("Are you sure you want to delete this question permanently?");
        if (result) {
            const that = this;
            const data = {}
            data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
            data.questionId = this.props.containerId.replace('question', '');

            $.post(
                editInPlaceGlobalData.deleteQuestionUrl,
                data,
                function(data, textStatus, jqXHR) {
                    const id = $('#' + that.props.containerId).parents('.group-outer-container').get(0).id
                    resetGroupHtml(id).then(() => showSuccessMessage(that.props.containerId, "Question deleted"));
                }
            )
                .fail(function(jqXHR) {
                    const response = JSON.parse(jqXHR.responseText);
                    if (response.message) {
                        alert(response.message);
                    } else {
                        alert(response);
                    }
                });
        }
        return false;
    }

    render() {
        return <div style={{paddingTop: "10px"}}>
            <i className="fa fa-fw"></i>
            <button onClick={this.onclick} className="btn btn-xs" data-toggle="tooltip" title="Delete question">
                <i className="fa fa-fw fa-trash text-danger"></i>
                Delete
            </button>
        </div>
    }
}

class ToolButtons extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            // Page can be 'base', 'edit', 'adv'
            page: 'base',
            // Content saves original text while editing
            content: {},
            // Loaded lazily when entering advanced form.
            questionAttributes: {},
            showSuccess: false
        };
        this.ref = React.createRef()
    }

    getAttributes() {
        const that = this;
        const data = {};
        data[editInPlaceGlobalData.csrfTokenName] = editInPlaceGlobalData.csrfToken;
        data.questionId = this.props.containerId.replace('question', '');
        $.get(
            editInPlaceGlobalData.getAttributesUrl,
            data,
            function(data, textStatus, jqXHR) {
                console.log('data', data);
                that.setState({questionAttributes: data});
            }
        );
    }

    componentDidUpdate() {
        $('.tooltip').hide()
        $('[data-toggle="tooltip"]').tooltip()
        this.recalculateWidth();
        if (this.state.page === 'adv' && $.isEmptyObject(this.state.questionAttributes)) {
            this.getAttributes();
        }
    }

    componentDidMount() {
        this.recalculateWidth();
        const messagesForMe = editInPlaceQueue.getNewMessages(this.props.containerId);
        for (let i = 0; i < messagesForMe.length; i++) {
            const message = messagesForMe[i];
            if (message.content === 'Saved') {
                this.setState({showSuccess: true});
                setTimeout(() => this.setState({showSuccess: false}), 2000);
            }
        }
        $('[data-toggle="tooltip"]').tooltip()
    }

    recalculateWidth() {
        const negWidth = this.ref.current ? -this.ref.current.offsetWidth : -30;
        const newWidth = negWidth - 8;
        this.ref.current.style.marginLeft = newWidth + 'px';
        $('#' + this.props.containerId).animate({marginLeft: (-newWidth) + 'px'}, 250);
    }

    render() {
        if (this.state.page === 'edit') {
            return <div
                ref={this.ref}
                className="edit-in-place-buttons text-left"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <SaveButton
                    tooltipTitle="Save"
                    icon="save"
                    containerId={this.props.containerId}
                    content={this.state.content}
                    flipState={(p) => this.setState({page: p})}
                />
                <CancelButton
                    tooltipTitle="Cancel"
                    icon="close"
                    content={this.state.content}
                    flipState={() => this.setState({page: 'base'})}
                />
            </div>;
        } else if (this.state.page === 'adv') {
            const mandatory = this.state.questionAttributes.mandatory;
            const encrypted = this.state.questionAttributes.encrypted;
            return <div
                ref={this.ref}
                className="edit-in-place-buttons text-left"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <div>
                    <i className="fa fa-fw"></i>
                    <SaveAdvancedForm
                        parent={this.ref}
                        icon="save"
                        tooltipTitle="Save"
                        flipState={(p) => this.setState({page: p})}
                        containerId={this.props.containerId}
                    />
                    <button onClick={() => this.setState({page: "base"})} className="btn btn-xs" title="Cancel" data-toggle="tooltip">
                        <i className="fa fa-fw fa-close"></i>
                    </button>
                </div>
                <MandatoryButtonGroup value={mandatory} />
                <br/>
                <EncryptedButtonGroup value={encrypted} />
                <br/>
                <div>
                    <i className="fa fa-fw fa-file" title="Condition" data-toggle="tooltip"></i>
                    <i className="fa fa-fw bold"><strong>&#123;</strong></i>
                    <input name="relevance" defaultValue={this.state.questionAttributes.relevance} />
                    {/*<textarea rows="1" value={this.state.questionAttributes.relevance}></textarea>*/}
                    <i className="fa fa-fw bold"><strong>&#125;</strong></i>
                </div>
                <div>
                    <DeleteQuestionButton containerId={this.props.containerId} />
                </div>
                {/*
                <div style={{margin: "2px"}} >
                    <i className="fa fa-fw fa-cog" title="Advanced attribute" data-toggle="tooltip"></i>
                    <select style={{width: "80px"}}>
                        {Object.entries(this.state.questionAttributes).map(([key, value]) => <option>{key}</option>)}
                    </select>
                    &nbsp;
                    <input />
                </div>
                */}
            </div>;
        } else if (this.state.page === 'base') {
            return <div
                ref={this.ref}
                className="edit-in-place-buttons"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <EditButton
                    tooltipTitle="Edit question"
                    icon="pencil"
                    flipState={() => this.setState({page: 'edit'})}
                    setContent={(c) => this.state.content = c}
                    containerId={this.props.containerId}
                />
                <br/>

                <button onClick={() => this.setState({page: 'adv'})} className="btn btn-xs" title="Expand" data-toggle="tooltip" data-placement="right">
                    <i className="fa fa-fw fa-ellipsis-h"></i>
                </button>
                <br/>

                <MoveButton
                    tooltipTitle="Move up"
                    icon="arrow-up"
                    containerId={this.props.containerId}
                    content={this.state.content}
                    flipState={(p) => this.setState({page: p})}
                    moveUrl={editInPlaceGlobalData.moveUpUrl}
                />
                <br/>
                <MoveButton
                    tooltipTitle="Move down"
                    icon="arrow-down"
                    containerId={this.props.containerId}
                    content={this.state.content}
                    flipState={(p) => this.setState({page: p})}
                    moveUrl={editInPlaceGlobalData.moveDownUrl}
                />
                <br/>
                { this.state.showSuccess && <><span style={{padding: "1px 5px", marginTop: "5px", opacity: 0.6}} data-toggle="tooltip" title="Question saved">
                    <i className="fa fa-fw fa-check text-primary"></i>
                </span></>
                }
            </div>;
        } else if (this.state.page === 'saving') {
            return <div
                ref={this.ref}
                className="edit-in-place-buttons"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <i className="fa fa-spinner fa-spin"></i>
            </div>;
        }
    }
}

class TopButtons extends React.Component {
    componentDidMount() {
        $('[data-toggle="tooltip"]').tooltip()
    }

    render() {
        return <div id="top-buttons" style={{position: "fixed", top: "50%", zIndex: 9999, left: "0", width: "43px"}}>
            <div style={{border: "10px black"}}>
                <AddNewQuestionButton />
                <ShowHiddenQuestions />
            </div>
        </div>
    }
}

// TODO: Remove code duplication
function showSuccessMessage(containerId, text) {
    editInPlaceQueue.add(new QueueMessage(containerId, 'Saved'));
}

function showErrorMessage(containerId, text) {
    const alertId = "alert_" + Math.floor(Math.random() * 999999);
    $('#' + containerId).prepend(`
        <div
            id="${alertId}"
            class="alert alert-dismissible bg-danger well-sm text-center"
            style="color: white; margin-top: -50px; display: none; position: absolute;"
            data-dismiss="alert"
            role="button"
        >
            <strong><i class="fa fa-exclamation-triangle"></i></strong>&nbsp;${text}
        </div>
    `);
    $("#" + alertId).fadeIn().delay(3000).fadeOut();
}

/**
 * Needed to bind expression events to fetched HTML.
 *
 * @param {number} questionId
 * @return {void}
 */
function resetExpressions(questionId)
{
    console.log('resetExpressions');
    $('body').unbind('relevance:on');
    $('body').unbind('relevance:off');
    triggerEmRelevance();
    const functionName = "LEMrel" + questionId;
    const fun = window[functionName];
    if (fun) {
        fun(last_sgqa);
    }
}

/**
 * Reset JS generated by EM.
 *
 * @param {?} doc
 */
function injectNewLemscripts(doc)
{
    const lemscripts = doc.querySelector("#lemscripts");
    window.eval(lemscripts.innerHTML);
    // Sadly, this is not enough to evaluate the JS - eval() must be used instead.
    $("#lemscripts").remove();
    $("body").append(lemscripts);
}

/**
 * Fetch survey HTML from URL and replace div with {id}
 *
 * @param {string} id Usually question1234 or similar
 * @return {Promise}
 * @todo Deal with failure
 */
function resetContainerHtml(id) {
    const url = window.location.href;
    const questionId = id.replace('question', '');
    return $.get(
        url,
        {ignorebrowsernavigationwarning: 1},
        function(newHtml, textStatus, jqXHR) {
            const doc = new DOMParser().parseFromString(newHtml, "text/html");
            const div = doc.querySelector("#" + id);
            if (div === null) {
                throw "Found no div with id " + id;
            }
            $("#" + id).replaceWith(div);

            injectNewLemscripts(doc);

            resetExpressions(questionId);
            initEditInPlaceMisc(div);
        }
    );
}

// TODO: Can use resetContainerHtml
/**
 * @param {string} groupDivId
 * @return {void}
*/
function resetGroupHtml(groupDivId) {
    console.log('resetGroupHtml', groupDivId);
    const url = window.location.href;
    return $.get(
        url,
        {ignorebrowsernavigationwarning: 1},
        function(newHtml, textStatus, jqXHR) {
            const doc = new DOMParser().parseFromString(newHtml, "text/html");
            const div = doc.querySelector("#" + groupDivId);
            $("#" + groupDivId).replaceWith(div);

            injectNewLemscripts(doc);

            resetExpressions();
            initEditInPlace();
        }
    );
}

function initEditInPlaceMisc(el /*: HTMLElement */) {
    const id         = el.id;
    const questionId = id.replace('question', '');
    const container = document.createElement('div');
    $(el).append(container);
    const root = ReactDOM.createRoot(container);
    root.render(<ToolButtons questionId={questionId} containerId={id} />);
}

function initEditSubquestion(el /*: HTMLElement */) {
    // TODO: Make React component of this instead? But don't need a container for each subquestion?
    const button = document.createElement('button');
    button.dataset.toggle = 'tooltip';
    button.title = 'Edit subquestion';
    button.innerHTML = '<i class="fa fa-fw fa-pencil"></i>';
    button.className = 'btn btn-xs hidden';
    $(button).on('click', function(event) {
        event.preventDefault();
        // Show modal
        $('#subquestion-modal').modal();
        return false;
    });
    $(el).prepend(button);
    $(el).hover(function() {
        $(button).removeClass('hidden');
    }, function () {
        $(button).addClass('hidden');
    });
}

/**
 * @return {void}
 */
function initEditInPlace() {
    console.log('initEditInPlace');
    // Loop all question containers and insert the edit buttons.
    $('.question-container').each(function(i, el) {
        initEditInPlaceMisc(el);
    });

    const topButtons = document.querySelector('#top-buttons');
    if (topButtons) {
        // Do nothing
    } else {
        const container2 = document.createElement('div');
        $(document.body).append(container2);
        const root2 = ReactDOM.createRoot(container2);
        root2.render(<TopButtons />);
    }

    // Init subquestion edit
    $('.subquestion-list [id^=answertext').each(function(i, el) {
        initEditSubquestion(el);
    });
}

// This will be ready after the jQuery is ready, due to Babel.
initEditInPlace();
