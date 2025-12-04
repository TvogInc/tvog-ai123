const ThinkingAnimation = () => {
  return (
    <div className="flex items-start gap-3 p-4">
      {/* Glowing orb with shimmer */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-glow flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 shimmer-effect" />
        <div className="w-4 h-4 relative z-10">
          <div className="absolute inset-0 rounded-full bg-primary-foreground/80 animate-ping opacity-75" />
          <div className="absolute inset-1 rounded-full bg-primary-foreground" />
        </div>
      </div>
      
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Thinking</span>
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
        
        {/* Animated wave bars with shimmer */}
        <div className="flex items-end gap-[3px] h-5 relative">
          <div className="absolute inset-0 shimmer-overlay rounded" />
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="w-[3px] bg-gradient-to-t from-primary via-primary to-primary/30 rounded-full animate-wave relative"
              style={{
                animationDelay: `${i * 60}ms`,
                height: '100%',
              }}
            />
          ))}
        </div>
        
        {/* Shimmer text skeleton */}
        <div className="flex gap-2 mt-1">
          <div className="h-2 w-16 bg-muted/50 rounded shimmer-bar" />
          <div className="h-2 w-24 bg-muted/50 rounded shimmer-bar [animation-delay:100ms]" />
          <div className="h-2 w-12 bg-muted/50 rounded shimmer-bar [animation-delay:200ms]" />
        </div>
      </div>
    </div>
  );
};

export default ThinkingAnimation;
