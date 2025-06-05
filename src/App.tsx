import React, { useEffect, useState, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable, DragEndEvent, CollisionDetection, closestCenter } from '@dnd-kit/core';
import { rectIntersection } from '@dnd-kit/core';
import { generateImage } from './utils/imageGeneration';
import Together from "together-ai";

const BASE_CHARACTER = {
  name: 'Fanto',
  description: 'A cheerful elephant in a 3D animated style like Zootopia, ready for mayhem',
  basePrompt: 'A cheerful 3D animated elephant standing upright, Zootopia style, high quality 3D render, white background, full body shot, modern Disney animation style, expressive face and eyes, friendly smile, clean 3D modeling, cinematic lighting, high production quality, centered composition',
  baseImage: '/fanto-base.png'
};

interface ActionBlock {
  id: string;
  text: string;
  createdAt: number;
  isNew: boolean;
  isInitialBlock?: boolean;
  used?: boolean;
  isFading?: boolean;
}

interface BlockSlot {
  id: string;
  block: ActionBlock | null;
}

// Initialize Together client
const together = new Together({
  apiKey: import.meta.env.VITE_TOGETHER_API_KEY
});

function DraggableBlock({ 
  block,
  index 
}: { 
  block: ActionBlock | null;
  index: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (block?.isNew) {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [block]);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block?.id || `empty-${index}`,
    data: { text: block?.text },
    disabled: !block || block.used
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 9999 : undefined,
    position: 'relative' as const,
    touchAction: 'none'
  } : undefined;

  if (!block) {
    return (
      <div className="h-auto min-h-[4rem] bg-gray-800/50 rounded mb-2 opacity-50" />
    );
  }

  if (block.used) {
    return (
      <div className="h-auto min-h-[4rem] bg-gray-800/30 rounded mb-2 opacity-30 transition-opacity duration-1000" />
    );
  }

  // Create display version of text with "Fanto" instead of just "him"
  const displayText = block.text.replace(/\bhim\b/gi, 'Fanto');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-3 rounded-lg font-bold
        shadow-lg shadow-purple-900/30 cursor-grab active:cursor-grabbing
        hover:from-violet-500 hover:to-indigo-500 
        mb-2 select-none min-h-[4rem] break-words
        backdrop-blur-sm border border-white/10
        transition-opacity duration-1000 ease-out
        ${isDragging ? 'opacity-75 scale-105 shadow-xl rotate-1' : ''}
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {displayText}
    </div>
  );
}

function Stage({ onDrop, children }: { onDrop: (text: string) => void, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'stage' });

  return (
    <div
      ref={setNodeRef}
      className="p-8 min-h-[300px] relative"
    >
      {children}
    </div>
  );
}

const cleanText = (text: string): string => {
  console.log('Cleaning text:', text);
  let cleaned = text
    // Fix common HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    // Remove any non-standard characters
    .replace(/[^\w\s.,!?;:()'"-]/g, '')
    // Fix multiple spaces
    .replace(/\s+/g, ' ')
    // Remove any remaining non-printable characters
    .replace(/[^\x20-\x7E]/g, '')
    // Remove any remaining HTML-like tags
    .replace(/<[^>]*>/g, '')
    // Remove any remaining special sequences
    .replace(/nbsp|x[0-9a-f]+|_\([xX][0-9a-f]+\)/gi, '')
    // Fix multiple spaces
    .replace(/\s+/g, ' ')
    .trim();

  console.log('Cleaned result:', cleaned);
  return cleaned;
};

const extractVerbAndObject = (text: string): { verb: string; object: string } => {
  // First clean any AI commentary or metadata
  const cleanedOfComments = text
    .replace(/GM".*$/i, '') // Remove GM" and everything after
    .replace(/new.*$/i, '') // Remove 'new' and everything after
    .replace(/\(.*?\)/g, '') // Remove anything in parentheses
    .replace(/!+$/, '') // Remove exclamation marks at the end
    .trim();

  // Remove pronouns and common words
  const cleanedText = cleanedOfComments.toLowerCase()
    .replace(/\b(him|his|he|the|a|an|to|at|with|on|in|for|of|by|and)\b/g, '')
    .replace(/\b(good|bad|nice|mean|fun|cool|awesome|great)\b/g, '') // Remove common adjectives
    .trim();

  // Common starting verbs to remove
  const startingVerbs = /^(make|have|let|force|get|give|put|throw|drop|stuff)/i;
  const textWithoutStartingVerb = cleanedText.replace(startingVerbs, '').trim();

  // Split into words
  const words = textWithoutStartingVerb.split(/\s+/);
  
  // First word is typically the main verb
  const verb = words[0] || '';
  
  // Rest of the words form the object
  const object = words.slice(1).join(' ');

  return { verb, object };
};

function App() {
  const [currentImage, setCurrentImage] = useState<string>(BASE_CHARACTER.baseImage);
  const [slots, setSlots] = useState<BlockSlot[]>([]);
  const [actionBlocks, setActionBlocks] = useState<ActionBlock[]>([]);
  const [customBlocks, setCustomBlocks] = useState<ActionBlock[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState(BASE_CHARACTER.basePrompt);
  const [activeModifications, setActiveModifications] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [resetTimer, setResetTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [usedActions, setUsedActions] = useState<Set<string>>(new Set());
  const [blockTimeouts, setBlockTimeouts] = useState<{ [key: string]: NodeJS.Timeout }>({});
  const [blockQueue, setBlockQueue] = useState<ActionBlock[]>([]);
  const [pendingActions, setPendingActions] = useState<string[]>([]);
  const [isProcessingActions, setIsProcessingActions] = useState(false);
  const ACTION_BATCH_DELAY = 1000; // 1 second window to batch actions
  const [batchTimeout, setBatchTimeout] = useState<NodeJS.Timeout | null>(null);
  const QUEUE_MIN_SIZE = 3;
  const BATCH_SIZE = 10;
  const VISIBLE_BLOCKS = 5;

  const intersectionThreshold = 0.9; // 90% intersection required

  const customCollisionDetection: CollisionDetection = (args) => {
    // Get base collisions using built-in detection
    const collisions = rectIntersection(args);
    if (!collisions?.length) return [];

    // Get rectangles and ensure they exist
    const activeRectObj = args.active.rect.current?.translated as ClientRect;
    const droppableRectObj = args.droppableRects.get(collisions[0].id) as ClientRect;

    if (!activeRectObj || !droppableRectObj) return [];

    // Calculate overlap area
    const overlapX = Math.min(
      activeRectObj.right - droppableRectObj.left,
      droppableRectObj.right - activeRectObj.left
    );
    const overlapY = Math.min(
      activeRectObj.bottom - droppableRectObj.top,
      droppableRectObj.bottom - activeRectObj.top
    );

    if (overlapX <= 0 || overlapY <= 0) return [];

    const overlapArea = overlapX * overlapY;
    const blockArea = activeRectObj.width * activeRectObj.height;
    const overlapRatio = overlapArea / blockArea;

    return overlapRatio >= intersectionThreshold ? collisions : [];
  };

  useEffect(() => {
    setSlots(Array.from({ length: 5 }, (_, i) => ({
      id: `slot-${i}`,
      block: null
    })));
    setIsLoading(false);
  }, []);

  const generateBlockBatch = async (existingActions: string[]): Promise<ActionBlock[]> => {
    if (!import.meta.env.VITE_TOGETHER_API_KEY) {
      console.error('Together API key missing - check your .env file');
      return [];
    }

    try {
      console.log('Generating new batch of blocks...');
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          {
              role: "system",
              content: `Generate a list of unique, funny slapstick commands. Mix playful silliness with dark humor and potty jokes. Each command should be creative and different from the others.

Rules for each command:
1. Keep it under 6 words
2. Use simple language
3. One action per command
4. Must include "him" somewhere in the command
5. End with exclamation mark
6. Each must be unique in both action and object
7. Format as a numbered list
8. Vary sentence structure creatively
9. Include a mix of:
   - Classic slapstick (pies, slips, falls)
   - Dark humor (cartoonish mishaps, non-graphic)
   - Potty humor (poop, farts, burps)
   - Gross-out gags (slime, bugs, food)
   - Silly transformations
   - Embarrassing situations

Example formats:
1. Paint him neon pink!
2. Drop a piano on him!
3. Make him eat stinky cheese!
4. Cover him in bug slime!
5. Give him explosive diarrhea!
6. Unleash skunks around him!
7. Make him slip on poop!
8. Feed him rotten eggs!
9. Turn him into toilet paper!
10. Make him fart rainbows!

Keep it playful and cartoonish, never truly harmful.
Make sure each command is different from these existing actions:
${existingActions.join('\n')}`
            },
            {
              role: "user",
              content: `Generate ${BATCH_SIZE} unique slapstick commands. Include a good mix of classic slapstick, dark humor, and potty jokes. Make each one creative and different from the others and the existing actions. Use varied sentence structures.`
            }
          ],
          temperature: 0.9,
          max_tokens: 500,
      }),
    });

      if (!response.ok) {
        throw new Error('Failed to generate blocks');
      }

    const data = await response.json();
      const generatedText = data.choices[0].message.content.trim();
      
      // Split the response into individual commands and clean them
      const commands = generatedText
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => line.replace(/^\d+\.\s*/, '')) // Remove numbering
        .filter((line: string) => line.endsWith('!')) // Ensure it's a proper command
        .map((text: string) => ({
          id: `block-${Date.now()}-${Math.random()}`,
          text,
          createdAt: Date.now(),
          isNew: true
        }));

      console.log('Generated batch:', commands);
      return commands;

    } catch (err) {
      console.error('Failed to generate block batch:', err);
      return [];
    }
  };

  const replenishQueue = async () => {
    if (blockQueue.length < QUEUE_MIN_SIZE) {
      const existingActions = [
        ...actionBlocks.map(block => block.text),
        ...blockQueue.map(block => block.text),
        ...Array.from(usedActions)
      ];

      const newBlocks = await generateBlockBatch(existingActions);
      if (newBlocks.length > 0) {
        setBlockQueue(prev => [...prev, ...newBlocks]);
      }
    }
  };

  useEffect(() => {
    const initializeBlocks = async () => {
      console.log('Starting block initialization...');
      setIsLoading(true);
      
      // Initialize empty slots
      setSlots(Array.from({ length: VISIBLE_BLOCKS }, (_, i) => ({
        id: `slot-${i}`,
        block: null
      })));

      // Generate initial batch of blocks
      const initialBlocks = await generateBlockBatch([]);
      
      if (initialBlocks.length > 0) {
        // Fill visible slots
        const visibleBlocks = initialBlocks.slice(0, VISIBLE_BLOCKS);
        const queueBlocks = initialBlocks.slice(VISIBLE_BLOCKS);

        // Update slots one at a time with delay
        for (let i = 0; i < visibleBlocks.length; i++) {
          const block = visibleBlocks[i];
          setActionBlocks(prev => [...prev, block]);
            setSlots(prev => {
              const newSlots = [...prev];
            newSlots[i] = { id: `slot-${i}`, block };
              return newSlots;
            });
          await new Promise(resolve => setTimeout(resolve, 600));
        }

        // Set remaining blocks to queue
        setBlockQueue(queueBlocks);
      }

      setIsLoading(false);
      setIsInitialLoad(false);
    };

    initializeBlocks();
  }, []);

  useEffect(() => {
    replenishQueue();
  }, [blockQueue.length]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    
    if (!over || !active.data.current?.text) return;

    if (over.id === 'stage') {
      const text = active.data.current.text;
      
      // Start image transition animation immediately
      setIsGeneratingImage(true);
      setIsImageLoaded(false);
      
      // Check if it's a main action block or custom block
      const isMainBlock = actionBlocks.some(block => block.id === active.id);
      const isCustomBlock = customBlocks.some(block => block.id === active.id);
      
      if (isMainBlock) {
        // Remove the used block
        setActionBlocks(prev => prev.filter(block => block.id !== active.id));
        
        // Get the slot that was emptied
        const usedSlotIndex = slots.findIndex(slot => slot.block?.id === active.id);
        
        if (usedSlotIndex !== -1) {
          // If we have a block in the queue, use it
          if (blockQueue.length > 0) {
            const [nextBlock, ...remainingQueue] = blockQueue;
            setBlockQueue(remainingQueue);
            
            // Add new block with isNew flag
            const newBlock = { ...nextBlock, isNew: true };
            setSlots(prev => {
              const newSlots = [...prev];
              newSlots[usedSlotIndex] = { 
                id: `slot-${usedSlotIndex}`, 
                block: newBlock
              };
              return newSlots;
            });
            
            // Add the new block to actionBlocks
            setActionBlocks(prev => [...prev, newBlock]);
          } else {
            // If queue is empty, show empty slot
            setSlots(prev => {
              const newSlots = [...prev];
              newSlots[usedSlotIndex] = { 
                id: `slot-${usedSlotIndex}`, 
                block: null 
              };
              return newSlots;
            });
          }
        }

        // Add to used actions set
        setUsedActions(prev => new Set(prev).add(text));
      } else if (isCustomBlock) {
        // Remove the custom block immediately
        setCustomBlocks(prev => prev.filter(block => block.id !== active.id));
        
        // Clear any existing timeout
        const timeout = blockTimeouts[active.id];
        if (timeout) {
          clearTimeout(timeout);
          setBlockTimeouts(prev => {
            const newTimeouts = { ...prev };
            delete newTimeouts[active.id];
            return newTimeouts;
          });
        }

        // Add to used actions set
        setUsedActions(prev => new Set(prev).add(text));
      }
      
      // Process the action
        handlePromptClick(text);
      }
  };

  const isActionUnique = (text: string): boolean => {
    // First clean any AI commentary or metadata
    const cleanedText = text
      .replace(/GM".*$/i, '')
      .replace(/new.*$/i, '')
      .replace(/\(.*?\)/g, '')
      .replace(/!+$/, '')
      .trim();

    const { verb, object } = extractVerbAndObject(cleanedText);
    
    // If we couldn't extract a verb or object, consider it not unique
    if (!verb || !object) {
      console.log('No verb or object found:', text);
      return false;
    }

    // Function to check if two actions are similar
    const areActionsSimilar = (text1: string, text2: string): boolean => {
      const action1 = extractVerbAndObject(text1);
      const action2 = extractVerbAndObject(text2);

      // Check for verb similarity
      const verbSimilar = action1.verb === action2.verb ||
                         action1.verb.includes(action2.verb) ||
                         action2.verb.includes(action1.verb);

      // Check for object similarity using more thorough comparison
      const objectWords1 = new Set(action1.object.split(/\s+/));
      const objectWords2 = new Set(action2.object.split(/\s+/));
      
      // Check if the main nouns overlap
      const objectSimilar = Array.from(objectWords1).some(word => 
        Array.from(objectWords2).some(word2 => 
          word.includes(word2) || word2.includes(word)
        )
      );

      return verbSimilar && objectSimilar;
    };

    // Check against existing blocks
    const existingBlocksTexts = actionBlocks.map((block: ActionBlock) => block.text);
    if (existingBlocksTexts.some((existingText: string) => areActionsSimilar(existingText, cleanedText))) {
      console.log('Action similar to existing block:', cleanedText);
      return false;
    }

    // Check against blocks in the queue
    const queueTexts = blockQueue.map((block: ActionBlock) => block.text);
    if (queueTexts.some((queueText: string) => areActionsSimilar(queueText, cleanedText))) {
      console.log('Action similar to queued block:', cleanedText);
      return false;
    }

    // Check against used actions
    const usedTexts = Array.from(usedActions) as string[];
    if (usedTexts.some((usedText: string) => areActionsSimilar(usedText, cleanedText))) {
      console.log('Action similar to used block:', cleanedText);
      return false;
    }

    console.log('Action is unique:', cleanedText, { verb, object });
    return true;
  };

  const validateBlock = (text: string, isCustomBlock: boolean = false): { isValid: boolean; message?: string } => {
    console.log('Starting validation for:', text);
    
    if (!text || text.trim().length < 2) {
      return { isValid: false, message: "Type something mean..." };
    }

    // Only check for pronouns in generated blocks, not custom ones
    if (!isCustomBlock && !text.match(/\b(him|his|he)\b/i)) {
      return { isValid: false, message: "Action must include him/his/he" };
    }

    // Check uniqueness for both generated and custom blocks
    if (!isActionUnique(text)) {
      return { isValid: false, message: "Action too similar to existing ones" };
    }

    return { isValid: true };
  };

  const handlePromptClick = async (text: string) => {
    console.log('handlePromptClick called with text:', text);
    
    // Add the new action to pending list
    setPendingActions(prev => [...prev, text]);
    
    // Clear any existing timeout
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }

    // Set a new timeout to process actions
    const timeout = setTimeout(async () => {
      setIsProcessingActions(true);
      
      // Get all pending actions
      const actionsToProcess = [...pendingActions, text];
      console.log('Processing batched actions:', actionsToProcess);

      // Add all modifications to the active list
      setActiveModifications(prev => [...prev, ...actionsToProcess]);

      // Generate a new cohesive prompt incorporating all modifications
      console.log('Generating modified prompt for:', actionsToProcess);
      
      try {
        const newPrompt = await generateModifiedPrompt(actionsToProcess);
        
        if (newPrompt) {
          console.log('New prompt generated:', newPrompt);
          setCurrentPrompt(newPrompt);
          
          console.log('Starting image generation for prompt:', newPrompt);
          const imageData = await generateImage(newPrompt);
          console.log('Received image data:', imageData ? 'success' : 'null');
          
          if (imageData) {
            setCurrentImage(imageData);
          } else {
            console.error('No image data received from generation');
          }
        } else {
          console.error('Failed to generate modified prompt');
        }
      } catch (error) {
        console.error('Error in image generation:', error);
      } finally {
        setIsGeneratingImage(false);
        setIsImageLoaded(false);
        setIsProcessingActions(false);
        setPendingActions([]); // Clear pending actions
      }
    }, ACTION_BATCH_DELAY); // 1 second window to batch actions

    setBatchTimeout(timeout);
  };

  const validateAndProcessBlock = async (text: string): Promise<{ isValid: boolean; processedText?: string; message?: string }> => {
    if (!import.meta.env.VITE_TOGETHER_API_KEY) {
      return { isValid: false, message: "API key missing" };
    }

    try {
      const existingActions = [
        ...actionBlocks.map(block => block.text),
        ...blockQueue.map(block => block.text),
        ...Array.from(usedActions)
      ].join(', ');

      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        messages: [
          {
              role: "system",
              content: `You are a validator for slapstick action commands. Your job is to:
1. Check if the action meets these criteria:
   - Uses "him" instead of names
   - Is 6 words or less
   - Is a single, clear action
   - Is unique compared to existing actions
   - Has proper grammar and structure
2. If valid, return ONLY the processed action text
3. If invalid, return ONLY "INVALID: [reason]"

Example valid actions:
- "Paint him neon pink!"
- "Launch him into space!"
- "Feed him hot peppers!"

Example responses:
Input: "make the elephant dance"
Output: "Make him dance!"

Input: "tickle him with feathers" (when there's already a similar tickling action)
Output: "INVALID: Too similar to existing action"

Input: "throw banana peels all around him and watch as he slips and falls repeatedly"
Output: "INVALID: Too long, exceeds 6 words"
`
          },
          {
              role: "user",
              content: `Process this action: "${text}"
Existing actions: ${existingActions}
`
            }
          ],
          temperature: 0.7,
          max_tokens: 50,
      }),
    });
      
      if (!response.ok) {
        throw new Error('Failed to validate action');
      }

    const data = await response.json();
      const result = data.choices[0].message.content.trim();

      if (result.startsWith('INVALID:')) {
        return {
          isValid: false,
          message: result.substring(8).trim()
        };
      }

      return {
        isValid: true,
        processedText: result
      };

    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        message: 'Failed to validate action'
      };
    }
  };

  const generateModifiedPrompt = async (modifications: string[]): Promise<string | null> => {
    try {
      if (!import.meta.env.VITE_TOGETHER_API_KEY) {
        throw new Error('Together API key missing');
      }

      // Instead of manually combining actions, let Mixtral create a cohesive scene description
      const baseDescription = `A 3D animated elephant in a Zootopia/modern Disney animation style.`;
      const styleRequirements = `
Style requirements:
- Maintain the exact same elephant character model and core features from the reference image
- Only modify the aspects mentioned in the actions
- Keep the same high-quality 3D render style with Pixar-like lighting
- White background
- Full body shot, centered composition
- Cinematic lighting
- Show clear emotional reactions and expressions
- Use slapstick cartoon physics for the actions
- Preserve the original character's proportions and core design`;

      // Get Mixtral to combine the description with the actions
      const sceneResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`
          },
          body: JSON.stringify({
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages: [
              {
                role: "system",
              content: `You are a scene description generator that creates simple, clear descriptions of a character's current state.

Rules:
1. Write ONLY a single descriptive sentence
2. Focus on describing what is visually happening
3. Keep the tone light and playful
4. NO technical terms, metadata, or class definitions
5. NO internal model information
6. NO quotes or special characters
7. Start with "A cheerful 3D animated elephant" and then describe the modifications
8. Keep it concise and clear

Example input: "Paint him blue" and "Make him dance"
Example output: A cheerful 3D animated elephant covered in bright blue paint dances energetically with a big smile.`
              },
              {
                role: "user",
              content: `Base description: ${baseDescription}
Action commands: ${modifications.join(' and ')}
                
Create a simple scene description showing the result of these actions.`
              }
            ],
            temperature: 0.7,
          max_tokens: 200
        })
      });

      if (!sceneResponse.ok) {
        throw new Error('Failed to generate scene description');
      }

      const sceneData = await sceneResponse.json();
      let sceneDescription = sceneData.choices[0].message.content.trim();
      
      // Clean up any remaining technical artifacts or quotes
      sceneDescription = sceneDescription
        .replace(/```.*?```/gs, '') // Remove code blocks
        .replace(/[`'"]/g, '') // Remove quotes
        .replace(/\s*-->\s*/g, ' ') // Remove arrows
        .replace(/\([^)]*\)/g, '') // Remove parentheses and their contents
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      // Combine with style requirements for image generation only
      const finalPrompt = `${sceneDescription}\n\n${styleRequirements}`;

      // Always use the base image as reference for consistency
      const baseImageData = BASE_CHARACTER.baseImage?.split(',')[1];
      if (!baseImageData) {
        throw new Error('Base image data not available');
      }

      // Use the combined prompt for image generation
      const response = await fetch('https://api.together.xyz/v1/images/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-kontext-pro",
          prompt: finalPrompt,
          reference_image: baseImageData,
          reference_image_weight: 1.0
        })
        });

        if (!response.ok) {
        const errorText = await response.text();
        console.error('Together API error details:', errorText);
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
      console.log('API Response data:', data);

      if (!data?.data?.[0]?.b64_json) {
        throw new Error('Invalid response from Kontext API');
      }

      return sceneDescription;

    } catch (err) {
      console.error('Failed to generate modified prompt:', err);
      
      // Simplified fallback that still tries to combine the description
      try {
        const fallbackResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_TOGETHER_API_KEY}`
          },
          body: JSON.stringify({
            model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
            messages: [
              {
                role: "system",
                content: "Create a simple, one-sentence description of the elephant with the applied actions. No technical terms or metadata."
              },
              {
                role: "user",
                content: `Base: A cheerful 3D animated elephant.
Actions: ${modifications.join(' and ')}`
              }
            ],
            temperature: 0.7,
            max_tokens: 200
          })
        });

        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          let fallbackDescription = fallbackData.choices[0].message.content.trim();
          
          // Clean up the fallback response too
          fallbackDescription = fallbackDescription
            .replace(/```.*?```/gs, '')
            .replace(/[`'"]/g, '')
            .replace(/\s*-->\s*/g, ' ')
            .replace(/\([^)]*\)/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          return fallbackDescription;
        }
      } catch (fallbackErr) {
        console.error('Fallback scene generation failed:', fallbackErr);
      }
      
      return 'A cheerful 3D animated elephant stands ready for the next action.';
    }
  };

  const addCustomBlock = async (text: string) => {
    console.log('addCustomBlock called with:', text);
    
    if (!text.trim()) {
      return "Type something mean...";
    }

      const newBlock = {
        id: `custom-${Date.now()}`,
      text: text.trim(),
        createdAt: Date.now(),
        isNew: true,
        isFading: false
      };
      
      console.log('Creating new block:', newBlock);
      setCustomBlocks(prev => {
        const filtered = prev.filter(block => block !== null);
        return [...filtered, newBlock];
      });

      // Set a timeout to start the fade
      const fadeTimeout = setTimeout(() => {
        setCustomBlocks(prev => 
          prev.map(block => 
            block.id === newBlock.id ? { ...block, isFading: true } : block
          )
        );
        
        // Remove block after fade animation
        setTimeout(() => {
          setCustomBlocks(prev => prev.filter(block => block.id !== newBlock.id));
          setBlockTimeouts(prev => {
            const newTimeouts = { ...prev };
            delete newTimeouts[newBlock.id];
            return newTimeouts;
          });
      }, 1000); // Match this with CSS transition duration
      }, 4500);

      setBlockTimeouts(prev => ({
        ...prev,
        [newBlock.id]: fadeTimeout
      }));

      return null;
  };

  useEffect(() => {
    console.log('customBlocks state changed:', customBlocks);
  }, [customBlocks]);

  const CustomBlocksSection = () => (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-purple-300 mb-2">Custom Actions</h3>
      <div className="space-y-2">
        {customBlocks.length === 0 ? (
          <div className="text-gray-500 italic">No custom actions yet</div>
        ) : (
          customBlocks.filter(block => block !== null).map((block, idx) => (
            <DraggableBlock
              key={block.id}
              block={block}
              index={idx}
            />
          ))
        )}
      </div>
    </div>
  );

  useEffect(() => {
    console.log('App mounted, customBlocks initialized:', customBlocks);
  }, []);

  // Check for API key
  useEffect(() => {
    if (!import.meta.env.VITE_TOGETHER_API_KEY) {
      setError('Together API key missing - check your .env file');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gradient-to-r from-purple-900 via-purple-800 to-purple-900 text-white p-4 border-b border-purple-700">
      </div>
  
      <div className="p-6 max-w-6xl mx-auto font-sans">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 via-purple-400 to-pink-500 text-transparent bg-clip-text mb-6 text-center">
          Fanto Elefanto
          </h1>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 ml-5">
          <div className="w-1/3 mt-20">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-semibold text-purple-300">Action Blocks</h2>
                <span className="text-sm text-purple-400/70 italic">drag to stage →</span>
      </div>
              
              {/* Main Action Blocks */}
              <div className="relative mb-8">
                {isLoading ? (
                  <div className="animate-pulse space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-auto min-h-[4rem] bg-gray-800 rounded"></div>
                    ))}
                  </div>
                ) : (
                  slots.map((slot, idx) => (
                    <DraggableBlock 
                      key={slot.id}
                      block={slot.block}
                      index={idx}
                    />
                  ))
                )}
              </div>

              {/* Write Your Own Section */}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-purple-300 mb-2">Write Your Own</h3>
                <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm border border-purple-700/30">
                  <form 
                    className="flex flex-col gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                      const text = input.value.trim();
                      console.log('Form submitted with text:', text);
                      const message = await addCustomBlock(text);
                      if (message) {
                        input.placeholder = message;
                        setTimeout(() => {
                          input.placeholder = "Type a custom action...";
                        }, 2000);
                      } else {
                        input.value = '';
                        input.placeholder = "Type a custom action...";
                      }
                    }}
                  >
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type a custom action..."
                        className="flex-1 bg-gray-900/50 border border-purple-600/30 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-semibold transition-colors"
                      >
                        Enter
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Custom Blocks Section */}
              <CustomBlocksSection />
          </div>

            <div className="flex-1 -mt-[128px]">
              <Stage onDrop={handlePromptClick}>
                <div className="relative w-full aspect-square mb-4">
                  {/* Stage background */}
                  <div 
                    className="absolute inset-0 flex items-end justify-center"
                    style={{
                      backgroundImage: 'url(/stage-platform.png)',
                      backgroundPosition: 'bottom center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '90% auto',
                      height: '100%',
                      zIndex: 0
                    }}
                  />
                  {currentImage && (
                    <div className="relative w-full h-full flex items-center justify-center z-20" style={{ marginBottom: '15%' }}>
                      <img 
                        src={currentImage} 
                        alt={currentPrompt}
                        className={`max-w-[70%] max-h-[70%] object-contain transition-opacity transition-transform transition-[filter] duration-500 ease-in-out
                          ${(isGeneratingImage || !isImageLoaded) ? 'animate-morphing' : 'opacity-100 scale-100 blur-0'}`}
                        style={{
                          filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))',
                          transform: 'translateY(-7%)',
                          willChange: 'transform, opacity, filter'
                        }}
                        onLoad={() => setIsImageLoaded(true)}
                        onError={(e) => {
                          console.error('Image failed to load:', e);
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          setIsImageLoaded(true);
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="bg-gray-800/50 border border-purple-700/30 p-4 rounded-lg backdrop-blur-sm">
                  <p className="text-purple-300 font-semibold mb-2">Current Scene:</p>
                  <p className="text-gray-300 text-lg">"{currentPrompt}"</p>
                </div>
                {activeModifications.length > 0 && (
                  <div className="mt-4 text-sm text-purple-300/70">
                    <p>Active modifications:</p>
                    <ul className="list-disc list-inside">
                      {activeModifications.map((mod, index) => (
                        <li key={index}>{mod}</li>
                ))}
              </ul>
                  </div>
                )}
              </Stage>
            </div>
          </div>
        </DndContext>
        </div>
    </div>
  );
}

export default App;