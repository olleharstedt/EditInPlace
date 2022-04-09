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
    }

    public function beforeSurveyPage()
    {
        $event = $this->getEvent();
        $surveyId = $event->get('surveyId');
        $survey = Survey::model()->findByPk($surveyId);
        if (!empty($survey) && $survey->active === 'N') {
            // Register React dev environment for edit-in-place in preview
            // @see https://reactjs.org/docs/add-react-to-a-website.html#quickly-try-jsx
            // @see https://raw.githubusercontent.com/reactjs/reactjs.org/main/static/html/single-file-example.html
            // @todo Not recommended for production use (but kind of OK since traffic will be low)
            App()->getClientScript()->registerScriptFile('https://unpkg.com/react@18/umd/react.development.js');
            App()->getClientScript()->registerScriptFile('https://unpkg.com/react-dom@18/umd/react-dom.development.js');
            App()->getClientScript()->registerScriptFile('https://unpkg.com/@babel/standalone/babel.min.js');
            $jsUrl = Yii::app()->assetManager->publish(dirname(__FILE__) . '/js/editinplace.js');
            $saveUrl = Yii::app()->createUrl(
                'admin/pluginhelper',
                array(
                    'plugin' => get_class($this),
                    'method' => 'actionSave',
                    'surveyId' => $surveyId
                )
            );

            App()->getClientScript()->registerScript(
                "EditInPlaceBaseUrl",
                "editInPlaceBaseUrl = " . json_encode($baseUrl) . ";",
                CClientScript::POS_BEGIN
            );
            App()->getClientScript()->registerScriptFile($jsUrl, null, ['type' => 'text/babel']);
        }
    }

    public function newDirectRequest()
    {
        if($this->event->get('target') != get_class($this)){
            return;
        }
    }
}
