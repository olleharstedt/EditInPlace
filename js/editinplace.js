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

class EditButtons extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            edit: false,
            // Content saves original text while editing
            content: {}
        };
        this.edit = this.edit.bind(this);
        this.cancel = this.cancel.bind(this);
        this.save = this.save.bind(this);
    }

    /**
     * Triggered when edit-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    edit(event) {
        event.preventDefault();
        // TODO: Mount input fields here, or widget?
        const ids = [
            '#' + this.props.containerId + ' .question-text',
            '#' + this.props.containerId + ' .question-code',
            '#' + this.props.containerId + ' .ls-questionhelp'
        ];
        const that = this;
        const replaceWithInput = function(id, i) {
            const text = $(id).text().trim();
            that.state.content[id] = text;
            const width = Math.min($(id).innerWidth(), 500);
            //console.log('width', width);
            $(id).html(`<input value="${text}" name="" style="width: ${width}px;" />`);
        };
        ids.forEach(replaceWithInput);
        this.setState({edit: true});
        return false;
    }

    /**
     * Triggered when cancel-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    cancel(event) {
        event.preventDefault();
        for (const id in this.state.content) {
            $(id).text(this.state.content[id]);
        }
        this.setState({edit: false});
        return false;
    }

    /**
     * Triggered when save-button is clicked
     *
     * @param {Event} event
     * @return {boolean}
     */
    save(event) {
        event.preventDefault();
        return false;
    }

    componentDidMount() {
        $('[data-toggle="tooltip"]').tooltip()
    }

    render() {
        if (this.state.edit) {
            return <div
                className="edit-in-place-buttons"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <button onClick={this.save} className="btn btn-xs" data-toggle="tooltip" title="Save">
                    <i className="fa fa-save"></i>
                </button>
                <br/>
                <button onClick={this.cancel} className="btn btn-xs" data-toggle="tooltip" title="Cancel">
                    <i className="fa fa-ban"></i>
                </button>
            </div>
        } else {
            return <div
                className="edit-in-place-buttons"
                style={{marginLeft: '-30px', position: 'absolute'}}
            >
                <button
                    className="btn btn-xs"
                    onClick={this.edit}
                    role="button"
                    title="Edit question"
                    data-toggle="tooltip"
                >
                    <i className="fa fa-pencil"></i>
                </button>
            </div>;
        }
    }
}

/**
 * Fired when edit-button is clicked
 *
 * @param {HTMLElement} that
 * @param {Event} ev
 * @param {number} questionId
 * @param {string} elementId
 * @return {void}
 */
function editInPlaceEdit(that, ev, questionId, elementId)
{
    if (editInPlaceState !== 'hover') {
        throw 'editInPlaceState must be hover when clicking on edit';
    }
    editInPlaceState = 'edit';

    //$('#question' + questionId).replaceWith(`<div>Hello</div>`);
    const $element = $('#' + elementId);
    const value = $element.text().trim();
    const originalHtml64 = btoa($element.html());
    // TODO: Deal with weird chars and escaping
    // TODO: How does this interact with clicking "Next" or "Back"?
    $element.replaceWith(`
        <div class="row" id="${elementId}">
            <div class="form-group col-md-6">
                <input id="" value="${value}" type="text" class="form-control col-6" />
            </div>
            <button class="btn btn-default btn-sm" onclick="editInPlaceSave(event);">Save</button>
            <button class="btn btn-default btn-sm" onclick="editInPlaceCancel(event, '${elementId}', '${originalHtml64}');">Cancel</button>
        </div>
    `);
}

function editInPlaceSave(ev)
{
    ev.preventDefault();
    $.ajax(
    );
    editInPlaceState = 'hover';
    return false;
}

/**
 * @param {Event} ev
 * @param {string} elementId
 * @param {string} org, base64 encoded
 */
function editInPlaceCancel(ev, elementId, org)
{
    ev.preventDefault();
    const html = atob(org);
    const $element = $('#' + elementId);
    $element.html(html);
    editInPlaceState = 'hover';
    return false;
}

/**
 * @return {void}
 */
function initEditInPlace() {
    // Loop all question containers and insert the edit buttons.
    $('.question-container').each(function(i, el) {
        const id         = el.id;
        const questionId = id.replace('question', '');
        const container = document.createElement('div');
        $(el).append(container);
        const root = ReactDOM.createRoot(container);
        root.render(<EditButtons questionId={questionId} containerId={id} />);
    });
}

// This will be ready after the jQuery is ready, due to Babel.
initEditInPlace();
