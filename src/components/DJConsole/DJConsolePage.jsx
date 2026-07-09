import MBTIRemixDeck from '../MBTIRemixDeck';
import StyleFaders from '../StyleFaders';
import ProjectDeck from '../ProjectDeck';
import GenreSelector from '../GenreSelector';
import ArrangerPanel from '../ArrangerPanel';
import VocalMode from '../VocalMode';
import PromptCard from '../PromptCard';

export default function DJConsolePage({
  axes,
  onAxesChange,
  theme,
  style,
  onStyleChange,
  projectName,
  projectDesc,
  onProjectNameChange,
  onProjectDescChange,
  onApplyPreset,
  onGithubAnalyze,
  analysisSource,
  mainDeck,
  genre,
  onGenreChange,
  arranger,
  onArrangerStart,
  onArrangerStop,
  onArrangerPhaseChange,
  onArrangerFeedback,
  liveStation,
  radioBusy,
  onRadioToggle,
  vocalMode,
  onVocalModeChange,
  promptData,
  promptLoading,
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="contents lg:col-span-4 lg:block lg:space-y-4">
        <div className="order-1 lg:order-none">
          <MBTIRemixDeck axes={axes} onAxesChange={onAxesChange} theme={theme} />
        </div>
        <div className="order-3 lg:order-none">
          <StyleFaders style={style} onStyleChange={onStyleChange} />
        </div>
        <div className="order-4 lg:order-none">
          <ProjectDeck
            name={projectName}
            description={projectDesc}
            onNameChange={onProjectNameChange}
            onDescriptionChange={onProjectDescChange}
            onApplyPreset={onApplyPreset}
            onGithubAnalyze={onGithubAnalyze}
            analysisSource={analysisSource}
          />
        </div>
      </div>

      <div className="contents lg:col-span-5 lg:block lg:space-y-4">
        <div className="order-2 lg:order-none">
          {mainDeck}
        </div>
        <div className="order-5 lg:order-none">
          <GenreSelector value={genre} onChange={onGenreChange} theme={theme} />
        </div>
      </div>

      <div className="contents lg:col-span-3 lg:block lg:space-y-4">
        <div id="dj-arranger-anchor" className="order-6 lg:order-none">
          <ArrangerPanel
            arranger={arranger}
            theme={theme}
            onStart={onArrangerStart}
            onStop={onArrangerStop}
            onPhaseChange={onArrangerPhaseChange}
            onFeedback={onArrangerFeedback}
            liveStation={liveStation}
            radioBusy={radioBusy}
            onRadioToggle={onRadioToggle}
          />
        </div>
        <div className="order-7 lg:order-none">
          <VocalMode vocalMode={vocalMode} onVocalModeChange={onVocalModeChange} />
        </div>
        <div className="order-8 lg:order-none">
          <PromptCard
            layers={promptData?.layers}
            fullPrompt={promptData?.fullPrompt}
            loading={promptLoading}
          />
        </div>
      </div>
    </div>
  );
}
