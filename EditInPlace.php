<?php

use LimeSurvey\PluginManager\PluginBase;

/**
 */
class EditInPlace extends PluginBase
{
    protected $storage = 'DbStorage';
    protected static $description = 'Edit-in-place in survey preview';
    protected static $name = 'EditInPlace';

    public function init()
    {
        $this->subscribe('beforeSurveyPage');
        $this->subscribe('newDirectRequest');
        $this->subscribe('beforeSurveySettings');
        $this->subscribe('newSurveySettings');
    }

    public function beforeSurveySettings()
	{
		$event = $this->event;
		$surveyId = intval($event->get('survey'));

        $event->set(
            "surveysettings.{$this->id}",
            [
                'name' => get_class($this),
                'settings' => [
                    'isActive' => [
                        'type' => 'boolean',
                        'label' => 'isActive',
                        'current' => $this->getIsActive($surveyId),
                        'help' => 'Activate plugin for this survey'
                    ],
                ]
            ]
        );
	}

    public function newSurveySettings()
    {
        $event = $this->event;
        foreach ($event->get('settings') as $name => $value)
        {
            $this->set($name, $value, 'Survey', $event->get('survey'), false);
        }
    }

    public function beforeSurveyPage()
    {
        $event = $this->getEvent();
        $surveyId = $event->get('surveyId');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            return;
        }

        if (!$this->getIsActive($surveyId)) {
            return;
        }

        $survey = Survey::model()->findByPk($surveyId);
        // TODO: Check edit permission for survey
        if (!empty($survey) && $survey->active === 'N') {
            // Register React dev environment for edit-in-place in preview
            // @see https://reactjs.org/docs/add-react-to-a-website.html#quickly-try-jsx
            // @see https://raw.githubusercontent.com/reactjs/reactjs.org/main/static/html/single-file-example.html
            // @todo Not recommended for production use (but kind of OK since traffic will be low)
            App()->getClientScript()->registerScriptFile('https://unpkg.com/react@18/umd/react.development.js');
            App()->getClientScript()->registerScriptFile('https://unpkg.com/react-dom@18/umd/react-dom.development.js');
            App()->getClientScript()->registerScriptFile('https://unpkg.com/@babel/standalone/babel.min.js');
            $saveUrl        = $this->getUrlToAction($surveyId, 'actionSave');
            $subquestionSaveUrl = $this->getUrlToAction($surveyId, 'actionSaveSubquestion');
            $saveAdvUrl     = $this->getUrlToAction($surveyId, 'actionSaveAdvancedForm');
            $moveUpUrl      = $this->getUrlToAction($surveyId, 'actionMoveUp');
            $moveDownUrl    = $this->getUrlToAction($surveyId, 'actionMoveDown');
            $getAttributesUrl = $this->getUrlToAction($surveyId, 'actionGetQuestionAttributes');
            $getTextsUrl    = $this->getUrlToAction($surveyId, 'actionGetQuestionTexts');
            $addQuestionUrl = $this->getUrlToAction($surveyId, 'actionAddQuestion');
            $deleteQuestionUrl = $this->getUrlToAction($surveyId, 'actionDeleteQuestion');
            $getStepUrl = $this->getUrlToAction($surveyId, 'actionGetStep');
            $tokenName = Yii::app()->request->csrfTokenName;
            $csrfToken = Yii::app()->request->csrfToken;
            $lang = Yii::app()->session['survey_' . $survey->sid]['s_lang'];

            if (empty($lang)) {
                throw new Exception('Found no lang for survey id ' . $survey->sid);
            }

            App()->getClientScript()->registerScript(
                "EditInPlaceBaseGlobalData",
                <<<JAVASCRIPT
var editInPlaceGlobalData = {
    saveUrl:            "$saveUrl",
    subquestionSaveUrl: "$subquestionSaveUrl",
    saveAdvUrl:         "$saveAdvUrl",
    moveUpUrl:          "$moveUpUrl",
    moveDownUrl:        "$moveDownUrl",
    getAttributesUrl:   "$getAttributesUrl",
    getTextsUrl:        "$getTextsUrl",
    addQuestionUrl:     "$addQuestionUrl",
    deleteQuestionUrl:  "$deleteQuestionUrl",
    getStepUrl:         "$getStepUrl",
    csrfTokenName:      "$tokenName",
    csrfToken:          "$csrfToken",
    lang:               "$lang",
    surveyId:           "$surveyId"
};
JAVASCRIPT
,
                CClientScript::POS_BEGIN
            );

            // TODO: Not used at the moment.
            //$this->renderPartial('modal', []);

            $jsUrl = Yii::app()->assetManager->publish(dirname(__FILE__) . '/js/editinplace.js');
            $cssUrl = Yii::app()->assetManager->publish(dirname(__FILE__) . '/css/editinplace.css');
            App()->getClientScript()->registerScriptFile($jsUrl, null, ['type' => 'text/babel']);
            App()->getClientScript()->registerCssFile($cssUrl);
        }
    }

    public function newDirectRequest()
    {
        if($this->event->get('target') != get_class($this)){
            return;
        }
    }

    public function actionSave()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');
        $questionId = (int) $request->getParam('questionId');
        $text       = $request->getParam('question');
        $code       = $request->getParam('code');
        $help       = $request->getParam('help');
        $lang       = $request->getParam('lang');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        /** @var ?Question */
        $question = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);
        if (empty($question)) {
            http_response_code(400);
            echo json_encode('Found no question with id ' . $questionId);
            Yii::app()->end();
        }

        // Only save question code if it's not empty
        if (!empty($code)) {
            $question->title = $code;
            if (!$question->save()) {
                http_response_code(400);
                echo json_encode("Could not save question code");
                Yii::app()->end();
            }
        }

        /** @var ?QuestionL10n */
        $l10n = QuestionL10n::model()->findByAttributes(['qid' => $questionId, 'language' => $lang]);
        if (empty($l10n)) {
            http_response_code(400);
            echo json_encode("Found no l10n with question id " . $questionId);
            Yii::app()->end();
        }

        // TODO: script field
        $l10n->question = $text;;
        $l10n->help = $help;;
        if (!$l10n->save()) {
            http_response_code(400);
            echo json_encode("Could not save question text or help");
            Yii::app()->end();
        }

        // Reset session data
        $this->killSession($surveyId);

        echo json_encode("Saved");
        http_response_code(200);
        Yii::app()->end();
    }

    public function actionSaveSubquestion()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');
        // This is the parent question id.
        $questionId = (int) $request->getParam('questionId');
        // This is the subquestion code.
        $code       = $request->getParam('code');
        $text       = $request->getParam('question');
        $help       = $request->getParam('help');
        $lang       = $request->getParam('lang');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            throw new CHttpException(403, "No permission");
        }

        /** @var ?Question */
        $parentQuestion = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);
        if (empty($parentQuestion)) {
            throw new CHttpException(404, "Parent question not found");
        }

        /** @var ?Question */
        $subquestion = Question::model()->findByAttributes(['code' => $code, 'sid' => $surveyId, 'parent_qid' => $questionId]);
        if (empty($subquestion)) {
            throw new CHttpException(404, "Subquestion not found");
        }

        /** @var ?QuestionL10n */
        $l10n = QuestionL10n::model()->findByAttributes(['qid' => $subquestion->qid, 'language' => $lang]);
        if (empty($l10n)) {
            throw new CHttpException(400, "Found no l10n with question id " . $subquestion->qid);
        }

        $l10n->question = $text;;
        if (!$l10n->save()) {
            throw new CHttpException(400, "Could not save question text or help");
        }

        // Reset session data
        $this->killSession($surveyId);

        echo json_encode("Saved");
        http_response_code(200);
        Yii::app()->end();
    }

    public function actionGetQuestionTexts()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');
        $questionId = (int) $request->getParam('questionId');
        $lang       = $request->getParam('lang');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $question   = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);

        echo json_encode(
            [
                'help'     => $question->questionl10ns[$lang]->help,
                'question' => $question->questionl10ns[$lang]->question,
                'code'     => $question->title
            ]
        );
        http_response_code(200);
        Yii::app()->end();
    }

    /**
     * Add question to group
     *
     * @return void
     */
    public function actionAddQuestion()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $lang       = $request->getParam('lang');
        $groupId    = (int) $request->getParam('groupId');
        $group      = QuestionGroup::model()->findByAttributes(['gid' => $groupId]);

        if (empty($group)) {
            http_response_code(404);
            echo json_encode('Found no group with id ' . $groupId);
            Yii::app()->end();
        }

        if (!Permission::model()->hasSurveyPermission($group->sid, 'surveycontent', 'create')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $question = new Question();
        $question->type = 'T';
        $question->title = 'Q' . rand(0, 10000);
        $question->sid = $group->sid;
        $question->gid = $group->gid;
        $question->parent_qid = 0;
        $question->relevance = "1";
        $question->mandatory = 'N';
        $question->question_order = 0;
        if (!$question->save()) {
            http_response_code(400);
            echo json_encode('Could not save new question: ' . json_encode($question->errors));
            Yii::app()->end();
        }

        $l10n = new QuestionL10n();
        $l10n->qid      = $question->qid;
        $l10n->question = 'Empty question';
        $l10n->language = $lang;
        if (!$l10n->save()) {
            http_response_code(400);
            echo json_encode('Could not save new question language data: ' . json_encode($l10n->errors));
            Yii::app()->end();
        }

        // Reset session data
        $this->killSession($group->sid);

        echo json_encode("Saved");
        http_response_code(200);
        Yii::app()->end();
    }

    public function actionGetQuestionAttributes()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $questionId = (int) $request->getParam('questionId');
        $lang       = $request->getParam('lang');
        $question   = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);
        $attrs      = QuestionAttribute::model()->getQuestionAttributes($questionId);
        $attrs = array_merge($attrs, $question->attributes);
        echo json_encode($attrs);
        http_response_code(200);
        Yii::app()->end();
    }

    public function actionSaveAdvancedForm()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');
        $questionId = (int) $request->getParam('questionId');
        $relevance  = $request->getPost('relevance');
        $mandatory  = $request->getPost('mandatory');
        $encrypted  = $request->getPost('encrypted');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $question = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);
        if (empty($question)) {
            http_response_code(400);
            echo json_encode('Found no question with id ' . $questionId);
            Yii::app()->end();
        }

        $question->relevance = $relevance;

        if (!empty($mandatory)) {
            $question->mandatory = $mandatory;
        }

        if (!empty($encrypted)) {
            $question->encrypted = $encrypted;
        }

        if (!$question->save()) {
            http_response_code(400);
            echo json_encode("Could not save advanced settings");
            Yii::app()->end();
        }

        // Reset session data
        $this->killSession($surveyId);

        echo json_encode("Saved");
        http_response_code(200);
        Yii::app()->end();
    }

    public function actionMoveUp()
    {
        $this->moveQuestionMisc(
            function($previousOrder) { return $previousOrder - 1; }
        );
    }

    public function actionMoveDown()
    {
        $this->moveQuestionMisc(
            function($previousOrder) { return $previousOrder + 1; }
        );
    }

    // TODO: Won't work since killSurveySession() is called before this one. :(
    // TODO: Store step before killing session.
    // TODO: Probably not needed if we immediately re-init session after kill, with
    // old step injected into new session.
    public function actionGetStep()
    {
        header('Content-Type: application/json');

        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'read')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $step = (int) $_SESSION['survey_' . $surveyId]['step'];

        http_response_code(200);
        echo json_encode(['step' => $step]);
        Yii::app()->end();
    }

    /**
     * Delete a question.
     *
     * @todo Delete group?
     */
    public function actionDeleteQuestion()
    {
        header('Content-Type: application/json');
        $request    = Yii::app()->request;
        $questionId = (int) $request->getParam('questionId');

        $question = Question::model()->findByAttributes(['qid' => $questionId]);
        if (empty($question)) {
            http_response_code(404);
            echo json_encode('Found no question with id ' . $questionId);
            Yii::app()->end();
        }
        $surveyId = $question->sid;

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        $count = (int) Question::model()->countByAttributes(['sid' => $question->sid]);
        if ($count < 2) {
            http_response_code(400);
            echo json_encode('Cannot delete last question in survey');
            Yii::app()->end();
        }

        if (!$question->delete()) {
            http_response_code(400);
            echo json_encode('Could not fully delete question with id ' . $questionId);
            Yii::app()->end();
        }

        // Reset session data
        $this->killSession($surveyId);

        http_response_code(200);
        echo json_encode('Question deleted');
        Yii::app()->end();
    }

    private function moveQuestionMisc(callable $calcNewOrder)
    {
        header('Content-Type: application/json');

        $request    = Yii::app()->request;
        $surveyId   = (int) $request->getParam('surveyId');
        $questionId = (int) $request->getParam('questionId');

        if (!Permission::model()->hasSurveyPermission($surveyId, 'surveycontent', 'update')) {
            http_response_code(403);
            echo json_encode('No permission');
            Yii::app()->end();
        }

        /** @var ?Question */
        $question = Question::model()->findByAttributes(['qid' => $questionId, 'sid' => $surveyId]);
        if (empty($question)) {
            http_response_code(400);
            echo json_encode('Found no question with id ' . $questionId);
            Yii::app()->end();
        }

        $previousOrder = $question->question_order;
        $swapQuestion = Question::model()->findByAttributes(['question_order' => $calcNewOrder($previousOrder), 'sid' => $surveyId, 'gid' => $question->gid]);

        $question->question_order = $calcNewOrder($previousOrder);
        if ($question->question_order < 0) {
            $question->question_order = 0;
        }
        if (!$question->save()) {
            http_response_code(400);
            echo json_encode("Could not save question");
            Yii::app()->end();
        }

        // Get question to swap place with
        if (empty($swapQuestion)) {
            // Nothing to swap with.
        } else {
            $swapQuestion->question_order = $previousOrder;
            $swapQuestion->save();
        }

        // Reset session data
        $this->killSession($surveyId);

        http_response_code(200);
        echo json_encode("Saved");
        Yii::app()->end();
    }

    /**
     * @param int $surveyId
     * @param string $action
     * @return string
     */
    private function getUrlToAction($surveyId, $action)
    {
        return Yii::app()->createUrl(
            'admin/pluginhelper',
            [
                'sa' => 'sidebody',
                'plugin' => get_class($this),
                'method' => $action,
                'surveyId' => $surveyId
            ]
        );
    }

    /**
     * Kill session but keep step information.
     */
    private function killSession($surveyId)
    {
        $sessId = 'survey_' . $surveyId;
        $step = (int) $_SESSION[$sessId]['step'];
        $lang = $_SESSION['LEMlang'];
        if (empty($lang)) {
            throw new Exception('Found no LEMlang, cannot reboot session');
        }
        killSurveySession($surveyId);
        $thissurvey = getSurveyInfo($surveyId, $lang);
        EmCacheHelper::init($thissurvey);
        buildsurveysession($surveyId);
        initFieldArray($surveyId, $_SESSION['survey_' . $surveyId]['fieldmap']);
        $_SESSION[$sessId]['step'] = $step;
    }

    private function getIsActive(int $sid): bool
    {
        return (bool) $this->get('isActive', 'Survey', $sid, false);
    }
}
